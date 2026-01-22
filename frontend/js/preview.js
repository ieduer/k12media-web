/**
 * Image Preview / Lightbox Component
 */

class ImagePreview {
    constructor() {
        this.lightbox = document.getElementById('lightbox');
        this.lightboxImg = document.getElementById('lightboxImg');
        this.lightboxInfo = document.getElementById('lightboxInfo');
        this.lightboxClose = document.getElementById('lightboxClose');
        this.lightboxPrev = document.getElementById('lightboxPrev');
        this.lightboxNext = document.getElementById('lightboxNext');

        this.images = [];
        this.currentIndex = 0;

        this.init();
    }

    init() {
        // Close button
        this.lightboxClose.addEventListener('click', () => this.close());

        // Navigation
        this.lightboxPrev.addEventListener('click', () => this.prev());
        this.lightboxNext.addEventListener('click', () => this.next());

        // Click outside to close
        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox) {
                this.close();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.lightbox.classList.contains('active')) return;

            switch (e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    this.prev();
                    break;
                case 'ArrowRight':
                    this.next();
                    break;
            }
        });
    }

    /**
     * Open lightbox with images
     * @param {Array} images - Array of image objects with url, subjectName, pageIndex
     * @param {number} startIndex - Starting index
     */
    open(images, startIndex = 0) {
        this.images = images;
        this.currentIndex = startIndex;
        this.showCurrent();
        this.lightbox.classList.add('active');
        this.lightbox.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.lightbox.classList.remove('active');
        setTimeout(() => {
            this.lightbox.classList.add('hidden');
        }, 250);
        document.body.style.overflow = '';
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showCurrent();
        }
    }

    next() {
        if (this.currentIndex < this.images.length - 1) {
            this.currentIndex++;
            this.showCurrent();
        }
    }

    showCurrent() {
        const image = this.images[this.currentIndex];
        this.lightboxImg.src = image.url;
        this.lightboxInfo.textContent = `${image.subjectName} - 第 ${image.pageIndex} 頁 (${this.currentIndex + 1}/${this.images.length})`;

        // Update navigation button visibility
        this.lightboxPrev.style.visibility = this.currentIndex > 0 ? 'visible' : 'hidden';
        this.lightboxNext.style.visibility = this.currentIndex < this.images.length - 1 ? 'visible' : 'hidden';
    }
}

// Export singleton
window.imagePreview = new ImagePreview();
