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
        this.batchDownloadSection = document.getElementById('batchDownloadSection');

        this.cookieInput = document.getElementById('cookieInput');
        this.authBtn = document.getElementById('authBtn');
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResult = document.getElementById('searchResult');
        this.studentInfo = document.getElementById('studentInfo');
        this.subjectTabs = document.getElementById('subjectTabs');
        this.imagesContainer = document.getElementById('imagesContainer');
        this.toastContainer = document.getElementById('toastContainer');

        // New Login Elements
        this.ssoLoginBtn = document.getElementById('ssoLoginBtn');
        this.usernameInput = document.getElementById('usernameInput');
        this.passwordInput = document.getElementById('passwordInput');
        this.ssoForm = document.getElementById('ssoForm');
        this.cookieForm = document.getElementById('cookieForm');
        this.authTabs = document.querySelector('.auth-tabs');

        // Manual Exam Input Elements
        this.manualExamInput = document.getElementById('manualExamInput');
        this.manualTestIdInput = document.getElementById('manualTestId');
        this.manualSchoolIdInput = document.getElementById('manualSchoolId');
        this.applyManualExamBtn = document.getElementById('applyManualExamBtn');
        this.refreshExamsBtn = document.getElementById('refreshExamsBtn');
        this.examSelect = document.getElementById('examSelect');

        // Batch Download Elements
        this.batchDownloadBtn = document.getElementById('batchDownloadBtn');
        this.batchSubjectSelect = document.getElementById('batchSubjectSelect');
        this.classCheckboxes = document.getElementById('classCheckboxes');
        this.batchProgress = document.getElementById('batchProgress');
        this.progressText = document.getElementById('progressText');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressFill = document.getElementById('progressFill');
        this.progressDetails = document.getElementById('progressDetails');

        // State
        this.currentStudent = null;
        this.currentSubject = 'all';
        this.studentData = null;
        this.allImages = [];
        this.currentTestId = null;
        this.currentSchoolId = 3600;
        this.isBatchDownloading = false;

        // Dynamic class discovery
        this.discoveredClasses = new Map(); // classId -> { label, isTeacherClass }
        // Pre-populate with default classes
        this.discoveredClasses.set(91268, { label: '格物3班 (行政班)', isTeacherClass: false });
        this.discoveredClasses.set(1883835, { label: '格物3班 (教學班)', isTeacherClass: true });
        this.discoveredClasses.set(91272, { label: '致知3班 (行政班)', isTeacherClass: false });
        this.discoveredClasses.set(1883842, { label: '致知3班 (教學班)', isTeacherClass: true });

        // Download Modal Elements
        this.downloadModal = document.getElementById('downloadModal');
        this.modalBackdrop = document.getElementById('modalBackdrop');
        this.modalClose = document.getElementById('modalClose');
        this.downloadSummary = document.getElementById('downloadSummary');
        this.previewImages = document.getElementById('previewImages');
        this.confirmDownloadBtn = document.getElementById('confirmDownloadBtn');
        this.cancelDownloadBtn = document.getElementById('cancelDownloadBtn');
        this.downloadProgress = document.getElementById('downloadProgress');
        this.modalProgressFill = document.getElementById('modalProgressFill');
        this.modalProgressText = document.getElementById('modalProgressText');
        this.downloadStudentBtn = document.getElementById('downloadStudentBtn');
        this.downloadSubjectSelect = document.getElementById('downloadSubjectSelect');

        // Pending download data
        this.pendingDownload = null;

        this.init();
    }

    init() {
        // Bind event listeners
        this.authBtn.addEventListener('click', () => this.handleAuth());
        this.ssoLoginBtn.addEventListener('click', () => this.handleSsoLogin());

        // Login Tabs
        this.authTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('auth-tab')) {
                this.handleTabSwitch(e.target.dataset.tab);
            }
        });

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

        // Manual Exam Input
        if (this.refreshExamsBtn) {
            this.refreshExamsBtn.addEventListener('click', () => this.loadExams());
        }
        if (this.applyManualExamBtn) {
            this.applyManualExamBtn.addEventListener('click', () => this.handleApplyManualExam());
        }

        // Batch Download
        if (this.batchDownloadBtn) {
            this.batchDownloadBtn.addEventListener('click', () => this.handleBatchDownload());
        }

        // Student Download Button
        if (this.downloadStudentBtn) {
            this.downloadStudentBtn.addEventListener('click', () => this.handleStudentDownload());
        }

        // Modal Events
        if (this.modalClose) {
            this.modalClose.addEventListener('click', () => this.closeDownloadModal());
        }
        if (this.modalBackdrop) {
            this.modalBackdrop.addEventListener('click', () => this.closeDownloadModal());
        }
        if (this.cancelDownloadBtn) {
            this.cancelDownloadBtn.addEventListener('click', () => this.closeDownloadModal());
        }
        if (this.confirmDownloadBtn) {
            this.confirmDownloadBtn.addEventListener('click', () => this.executeDownload());
        }

        // Check for stored cookie
        const storedCookie = window.api.getCookie();
        if (storedCookie) {
            this.cookieInput.value = storedCookie;
            this.validateStoredCookie(storedCookie);
        }
    }

    // ========== Authentication ==========

    handleTabSwitch(tab) {
        // Update tab buttons
        this.authTabs.querySelectorAll('.auth-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Toggle forms
        if (tab === 'sso') {
            this.ssoForm.classList.remove('hidden');
            this.cookieForm.classList.add('hidden');
        } else {
            this.ssoForm.classList.add('hidden');
            this.cookieForm.classList.remove('hidden');
        }
    }

    async handleSsoLogin() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();

        if (!username || !password) {
            this.showToast('請輸入用戶名和密碼', 'warning');
            return;
        }

        this.ssoLoginBtn.disabled = true;
        this.ssoLoginBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;"></span>登錄中...';

        try {
            const result = await window.api.login(username, password);

            if (result.success) {
                window.api.setCookie(result.cookie);
                this.setConnected(true);
                await this.loadExams();
                this.showToast('登錄成功！', 'success');
            } else {
                this.showToast(result.error || '登錄失敗', 'error');
            }
        } catch (error) {
            this.showToast(`登錄請求失敗: ${error.message}`, 'error');
        } finally {
            this.ssoLoginBtn.disabled = false;
            this.ssoLoginBtn.innerHTML = '<span class="btn-icon">🚀</span>登錄';
        }
    }

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
                await this.loadExams();
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
                // Load exams after successful validation
                await this.loadExams();
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
            if (this.batchDownloadSection) {
                this.batchDownloadSection.classList.remove('hidden');
            }
        } else {
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.querySelector('.status-text').textContent = '未連接';
            this.searchSection.classList.add('hidden');
            this.viewerSection.classList.add('hidden');
            this.aiSection.classList.add('hidden');
            if (this.batchDownloadSection) {
                this.batchDownloadSection.classList.add('hidden');
            }
        }
    }

    // ========== Exam Selection ==========

    async loadExams() {
        const examSelect = document.getElementById('examSelect');
        if (!examSelect) return;

        try {
            // Show loading state in dropdown
            examSelect.innerHTML = '<option>加載考試列表...</option>';
            if (this.manualExamInput) {
                this.manualExamInput.classList.add('hidden');
            }

            const response = await window.api.getExams();
            // API returns { exams: [...] } object
            const exams = response?.exams || response || [];

            if (exams && exams.length > 0) {
                examSelect.innerHTML = exams.map(exam =>
                    `<option value="${exam.id}">${exam.name}</option>`
                ).join('');
                // Select the first one by default (usually latest)
                examSelect.value = exams[0].id;
                this.currentTestId = exams[0].id;
                this.showToast(`已加載 ${exams.length} 場考試`, 'success');
            } else {
                examSelect.innerHTML = '<option value="" disabled>未找到考試 - 請手動輸入</option>';
                // Show manual input
                if (this.manualExamInput) {
                    this.manualExamInput.classList.remove('hidden');
                }
                this.showToast('未找到考試，請手動輸入考試 ID', 'warning');
            }
        } catch (error) {
            console.error('Load exams failed:', error);
            examSelect.innerHTML = '<option value="" disabled>加載失敗 - 請手動輸入</option>';
            // Show manual input on error
            if (this.manualExamInput) {
                this.manualExamInput.classList.remove('hidden');
            }
            this.showToast('加載考試列表失敗，請手動輸入', 'error');
        }
    }

    handleApplyManualExam() {
        const testId = this.manualTestIdInput?.value.trim();
        const schoolId = this.manualSchoolIdInput?.value.trim() || '3600';

        if (!testId) {
            this.showToast('請輸入考試 ID', 'warning');
            return;
        }

        // Update the dropdown to show the manual entry
        this.examSelect.innerHTML = `<option value="${testId}" selected>手動輸入: ${testId}</option>`;
        this.currentTestId = testId;
        this.currentSchoolId = parseInt(schoolId);

        // Hide the manual input section
        if (this.manualExamInput) {
            this.manualExamInput.classList.add('hidden');
        }

        this.showToast(`已設置考試 ID: ${testId}`, 'success');
    }

    // ========== Student Search ==========

    async handleSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.showToast('請輸入學號或姓名', 'warning');
            return;
        }

        const testId = document.getElementById('examSelect').value;
        if (!testId) {
            this.showToast('請選擇一場考試', 'warning');
            return;
        }

        this.searchResult.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>正在搜索...</p></div>';
        this.searchBtn.disabled = true;

        try {
            // Pass discovered class IDs to help backend find student
            const classIds = Array.from(this.discoveredClasses.keys());
            const result = await window.api.getStudentImages(query, testId, null, classIds);

            this.studentData = result;
            this.currentStudent = result.student;

            // Check if we discovered a new class
            if (result.student.classId) {
                this.handleDiscoveredClass(result.student.classId, result.student.classLabel);
            }

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

    handleDiscoveredClass(classId, classLabel) {
        if (!this.discoveredClasses.has(classId)) {
            // New class found!
            this.discoveredClasses.set(classId, {
                label: classLabel || `班級 ${classId}`,
                isTeacherClass: false // We assume false for auto-discovered classes
            });
            this.showToast(`已發現新班級: ${classLabel}`, 'success');

            // Update UI checkbox
            this.addBatchDownloadCheckbox(classId, classLabel || `班級 ${classId}`);
        }
    }

    addBatchDownloadCheckbox(classId, label) {
        if (!this.classCheckboxes) return;

        //Check if checkbox already exists
        if (this.classCheckboxes.querySelector(`input[value="${classId}"]`)) return;

        const labelEl = document.createElement('label');
        labelEl.className = 'checkbox-item';
        labelEl.innerHTML = `
            <input type="checkbox" name="class" value="${classId}" data-teacher="0" checked>
            <span class="checkbox-label">${label} (新發現)</span>
        `;
        this.classCheckboxes.appendChild(labelEl);
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

    // ========== Download Functions ==========

    async handleStudentDownload() {
        if (!this.currentStudent) {
            this.showToast('請先搜索學生', 'warning');
            return;
        }

        const testId = document.getElementById('examSelect').value;
        if (!testId) {
            this.showToast('請選擇考試', 'warning');
            return;
        }

        const subjectValue = this.downloadSubjectSelect?.value || 'all';
        const subjectIds = subjectValue === 'all' ? null : [parseInt(subjectValue)];

        this.showToast('正在準備下載預覽...', 'info');

        try {
            const classIds = Array.from(this.discoveredClasses.keys());
            const result = await window.api.prepareDownload({
                type: 'student',
                identifier: this.currentStudent.noInClass || this.currentStudent.name,
                subjectIds: subjectIds,
                testId: testId,
                classIds: classIds // Pass known classes
            });

            this.openDownloadModal(result, `${this.currentStudent.name}_試卷`);
        } catch (error) {
            this.showToast(`準備下載失敗: ${error.message}`, 'error');
        }
    }

    async handleBatchDownload() {
        if (this.isBatchDownloading) {
            this.showToast('下載進行中，請稍候...', 'warning');
            return;
        }

        const testId = document.getElementById('examSelect').value;
        if (!testId) {
            this.showToast('請選擇考試', 'warning');
            return;
        }

        // Get selected classes
        const selectedClasses = [];
        document.querySelectorAll('#classCheckboxes input[name="class"]:checked').forEach(cb => {
            selectedClasses.push({
                classId: parseInt(cb.value),
                isTeacherClass: cb.dataset.teacher === '1'
            });
        });

        if (selectedClasses.length === 0) {
            this.showToast('請選擇至少一個班級', 'warning');
            return;
        }

        const subjectId = parseInt(this.batchSubjectSelect?.value || '2');

        this.showToast('正在準備批量下載...', 'info');
        this.isBatchDownloading = true;

        try {
            // For simplicity, download first selected class
            const firstClass = selectedClasses[0];
            const result = await window.api.prepareDownload({
                type: 'class',
                classId: firstClass.classId,
                subjectIds: [subjectId],
                testId: testId,
                isTeacherClass: firstClass.isTeacherClass,
            });

            const subjectNames = { 1: '語文', 2: '數學', 3: '英語', 4: '物理', 5: '化學', 6: '生物', 7: '政治', 8: '歷史', 9: '地理' };
            this.openDownloadModal(result, `班級_${subjectNames[subjectId] || '試卷'}`);
        } catch (error) {
            this.showToast(`準備下載失敗: ${error.message}`, 'error');
        } finally {
            this.isBatchDownloading = false;
        }
    }

    openDownloadModal(downloadData, filename) {
        this.pendingDownload = {
            images: downloadData.images,
            filename: `${filename}_${new Date().toISOString().slice(0, 10)}.zip`
        };

        // Update summary
        this.downloadSummary.innerHTML = `
            <p><strong>學生數量:</strong> ${downloadData.totalStudents} 人</p>
            <p><strong>圖片數量:</strong> ${downloadData.totalImages} 張</p>
            <p><strong>文件名:</strong> ${this.pendingDownload.filename}</p>
        `;

        // Show preview images (limit to first 20 for performance)
        const previewLimit = 20;
        const previewData = downloadData.images.slice(0, previewLimit);

        this.previewImages.innerHTML = previewData.map(img => `
            <div class="preview-image-item">
                <img src="${window.api.getProxyImageUrl(img.url)}" alt="${img.studentName}" loading="lazy">
                <div class="preview-label">${img.studentName} - ${img.subjectName}</div>
            </div>
        `).join('');

        if (downloadData.images.length > previewLimit) {
            this.previewImages.innerHTML += `<div class="preview-image-item" style="display:flex;align-items:center;justify-content:center;color:var(--text-secondary);">+${downloadData.images.length - previewLimit} 更多</div>`;
        }

        // Reset progress
        this.downloadProgress.classList.add('hidden');
        this.modalProgressFill.style.width = '0%';
        this.modalProgressText.textContent = '0%';
        this.confirmDownloadBtn.disabled = false;

        // Show modal
        this.downloadModal.classList.remove('hidden');
    }

    closeDownloadModal() {
        this.downloadModal.classList.add('hidden');
        this.pendingDownload = null;
    }

    async executeDownload() {
        if (!this.pendingDownload) return;

        this.confirmDownloadBtn.disabled = true;
        this.downloadProgress.classList.remove('hidden');

        try {
            await window.api.downloadAsZip(
                this.pendingDownload.images,
                this.pendingDownload.filename,
                (current, total) => {
                    const percent = Math.round((current / total) * 100);
                    this.modalProgressFill.style.width = `${percent}%`;
                    this.modalProgressText.textContent = `${percent}% (${current}/${total})`;
                }
            );

            this.showToast('下載完成！', 'success');
            this.closeDownloadModal();
        } catch (error) {
            this.showToast(`下載失敗: ${error.message}`, 'error');
            this.confirmDownloadBtn.disabled = false;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new K12MediaApp();
});
