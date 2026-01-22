/**
 * K12Media 試卷查看器 - Main Application
 */

class K12MediaApp {
    constructor() {
        // DOM elements
        this.connectionStatus = document.getElementById('connectionStatus');
        this.authSection = document.getElementById('authSection');
        this.searchSection = document.getElementById('searchSection');
        this.viewerSection = document.getElementById('viewerSection');
        this.aiSection = document.getElementById('aiSection');

        this.cookieInput = document.getElementById('cookieInput');
        this.authBtn = document.getElementById('authBtn');
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResult = document.getElementById('searchResult');
        this.studentInfo = document.getElementById('studentInfo');
        this.subjectTabs = document.getElementById('subjectTabs');
        this.imagesContainer = document.getElementById('imagesContainer');
        this.toastContainer = document.getElementById('toastContainer');

        // State
        this.currentStudent = null;
        this.currentSubject = 'all';
        this.studentData = null;
        this.allImages = [];

        this.init();
    }

    init() {
        // Bind event listeners
        this.authBtn.addEventListener('click', () => this.handleAuth());
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Subject tabs
        this.subjectTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.handleSubjectChange(e.target.dataset.subject);
            }
        });

        // Check for stored cookie
        const storedCookie = window.api.getCookie();
        if (storedCookie) {
            this.cookieInput.value = storedCookie;
            this.validateStoredCookie(storedCookie);
        }
    }

    // ========== Authentication ==========

    async handleAuth() {
        const cookie = this.cookieInput.value.trim();
        if (!cookie) {
            this.showToast('請輸入 Cookie', 'error');
            return;
        }

        this.authBtn.disabled = true;
        this.authBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;"></span>驗證中...';

        try {
            const result = await window.api.validateCookie(cookie);

            if (result.valid) {
                window.api.setCookie(cookie);
                this.setConnected(true);
                this.showToast('認證成功！', 'success');
            } else {
                this.showToast(result.message || '認證失敗', 'error');
            }
        } catch (error) {
            this.showToast(`連接失敗: ${error.message}`, 'error');
        } finally {
            this.authBtn.disabled = false;
            this.authBtn.innerHTML = '<span class="btn-icon">🔗</span>連接';
        }
    }

    async validateStoredCookie(cookie) {
        try {
            const result = await window.api.validateCookie(cookie);
            if (result.valid) {
                this.setConnected(true);
            }
        } catch (error) {
            console.error('Stored cookie validation failed:', error);
        }
    }

    setConnected(connected) {
        if (connected) {
            this.connectionStatus.classList.add('connected');
            this.connectionStatus.querySelector('.status-text').textContent = '已連接';
            this.searchSection.classList.remove('hidden');
            this.aiSection.classList.remove('hidden');
        } else {
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.querySelector('.status-text').textContent = '未連接';
            this.searchSection.classList.add('hidden');
            this.viewerSection.classList.add('hidden');
            this.aiSection.classList.add('hidden');
        }
    }

    // ========== Student Search ==========

    async handleSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.showToast('請輸入學號或姓名', 'warning');
            return;
        }

        this.searchResult.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>正在搜索...</p></div>';
        this.searchBtn.disabled = true;

        try {
            const result = await window.api.getStudentImages(query);
            this.studentData = result;
            this.currentStudent = result.student;
            this.displayStudentInfo(result.student);
            this.processImages(result.subjects);
            this.viewerSection.classList.remove('hidden');
            this.searchResult.innerHTML = '';
            this.handleSubjectChange('all');
        } catch (error) {
            this.searchResult.innerHTML = `<div class="error">❌ ${error.message}</div>`;
            this.viewerSection.classList.add('hidden');
        } finally {
            this.searchBtn.disabled = false;
        }
    }

    displayStudentInfo(student) {
        const initial = student.name.charAt(0);
        this.studentInfo.innerHTML = `
      <div class="student-avatar">${initial}</div>
      <div class="student-details">
        <h3>${student.name}</h3>
        <p>學號: ${student.noInClass} | 班級: ${student.classLabel}</p>
      </div>
    `;
    }

    processImages(subjects) {
        this.allImages = [];

        for (const [subjectId, data] of Object.entries(subjects)) {
            for (const image of data.images) {
                this.allImages.push({
                    subjectId: parseInt(subjectId),
                    subjectName: data.subjectName,
                    pageIndex: image.pageIndex,
                    url: window.api.getProxyImageUrl(image.url),
                    originalUrl: image.url,
                });
            }
        }
    }

    // ========== Subject Tabs ==========

    handleSubjectChange(subject) {
        this.currentSubject = subject;

        // Update tab styles
        this.subjectTabs.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subject === subject);
        });

        this.renderImages();
    }

    renderImages() {
        let imagesToShow = this.allImages;

        if (this.currentSubject !== 'all') {
            const subjectId = parseInt(this.currentSubject);
            imagesToShow = this.allImages.filter(img => img.subjectId === subjectId);
        }

        if (imagesToShow.length === 0) {
            this.imagesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>沒有找到圖片</p>
        </div>
      `;
            return;
        }

        if (this.currentSubject === 'all') {
            // Group by subject
            this.renderGroupedImages(imagesToShow);
        } else {
            // Flat grid
            this.renderFlatImages(imagesToShow);
        }
    }

    renderGroupedImages(images) {
        const groups = {};

        for (const img of images) {
            if (!groups[img.subjectId]) {
                groups[img.subjectId] = {
                    subjectName: img.subjectName,
                    images: [],
                };
            }
            groups[img.subjectId].images.push(img);
        }

        let html = '';
        for (const [subjectId, group] of Object.entries(groups)) {
            if (group.images.length === 0) continue;

            html += `
        <div class="subject-group">
          <h3 class="subject-group-title">
            <span class="subject-badge" data-subject="${subjectId}">${group.subjectName}</span>
            <span style="color:var(--text-secondary);font-weight:400;font-size:0.875rem;">${group.images.length} 張</span>
          </h3>
          <div class="images-grid">
            ${group.images.map((img, idx) => this.renderImageCard(img, this.getGlobalIndex(img))).join('')}
          </div>
        </div>
      `;
        }

        this.imagesContainer.innerHTML = html;
        this.bindImageClicks();
    }

    renderFlatImages(images) {
        const html = `
      <div class="images-grid">
        ${images.map((img, idx) => this.renderImageCard(img, this.getGlobalIndex(img))).join('')}
      </div>
    `;

        this.imagesContainer.innerHTML = html;
        this.bindImageClicks();
    }

    renderImageCard(image, globalIndex) {
        return `
      <div class="image-card" data-index="${globalIndex}">
        <img src="${image.url}" alt="${image.subjectName} 第${image.pageIndex}頁" loading="lazy">
        <div class="image-card-info">
          <span class="image-card-subject" style="background:var(--subject-${image.subjectId})">${image.subjectName}</span>
          <span class="image-card-page">第 ${image.pageIndex} 頁</span>
        </div>
      </div>
    `;
    }

    getGlobalIndex(image) {
        return this.allImages.findIndex(img =>
            img.subjectId === image.subjectId && img.pageIndex === image.pageIndex
        );
    }

    bindImageClicks() {
        this.imagesContainer.querySelectorAll('.image-card').forEach(card => {
            card.addEventListener('click', () => {
                const index = parseInt(card.dataset.index);
                window.imagePreview.open(this.allImages, index);
            });
        });
    }

    // ========== Toast Notifications ==========

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
        };

        toast.innerHTML = `<span>${icons[type] || icons.info}</span> ${message}`;
        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.25s ease reverse';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new K12MediaApp();
});
