/**
 * A small, dependency-free fixed-height virtual list with lazy images.
 * Only the rows around the viewport exist in the DOM; an image receives its
 * `src` only after its row enters the configured IntersectionObserver margin.
 */
(function (global) {
    'use strict';

    function LazyVirtualList(options) {
        if (!options || !options.container || !Array.isArray(options.items)) {
            throw new Error('LazyVirtualList requires a container and an items array.');
        }

        this.container = options.container;
        this.items = options.items;
        this.itemHeight = Number(options.itemHeight) || 120;
        this.overscan = Math.max(0, Number(options.overscan) || 3);
        this.rootMargin = options.rootMargin || '100px 0px';
        this.renderItem = options.renderItem || this.defaultRenderItem;
        this.loadedUrls = new Set();
        this.frame = null;

        this.content = document.createElement('div');
        this.content.className = 'lazy-virtual-list__content';
        this.container.classList.add('lazy-virtual-list');
        this.container.appendChild(this.content);

        this.observer = 'IntersectionObserver' in global
            ? new IntersectionObserver(this.onIntersect.bind(this), {
                root: this.container,
                rootMargin: this.rootMargin,
                threshold: 0
            })
            : null;

        this.onScroll = this.scheduleRender.bind(this);
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
        this.render();
    }

    LazyVirtualList.prototype.defaultRenderItem = function (item) {
        var row = document.createElement('article');
        row.className = 'lazy-virtual-list__item';
        var image = document.createElement('img');
        image.className = 'lazy-virtual-list__image';
        image.alt = item.alt || '';
        image.dataset.src = item.image;
        var text = document.createElement('div');
        text.className = 'lazy-virtual-list__text';
        text.textContent = item.title || '';
        row.appendChild(image);
        row.appendChild(text);
        return row;
    };

    LazyVirtualList.prototype.scheduleRender = function () {
        var self = this;
        if (this.frame) return;
        this.frame = global.requestAnimationFrame(function () {
            self.frame = null;
            self.render();
        });
    };

    LazyVirtualList.prototype.range = function () {
        var visible = Math.ceil(this.container.clientHeight / this.itemHeight);
        var first = Math.floor(this.container.scrollTop / this.itemHeight);
        return {
            start: Math.max(0, first - this.overscan),
            end: Math.min(this.items.length, first + visible + this.overscan)
        };
    };

    LazyVirtualList.prototype.render = function () {
        var range = this.range();
        var fragment = document.createDocumentFragment();
        var index;
        this.content.style.height = (this.items.length * this.itemHeight) + 'px';
        if (this.observer) this.observer.disconnect();

        for (index = range.start; index < range.end; index++) {
            var row = this.renderItem(this.items[index], index);
            row.classList.add('lazy-virtual-list__item');
            row.style.position = 'absolute';
            row.style.top = (index * this.itemHeight) + 'px';
            row.style.height = this.itemHeight + 'px';
            row.style.width = '100%';
            var images = row.querySelectorAll('img[data-src]');
            for (var imageIndex = 0; imageIndex < images.length; imageIndex++) {
                this.watchImage(images[imageIndex]);
            }
            fragment.appendChild(row);
        }
        this.content.replaceChildren(fragment);
    };

    LazyVirtualList.prototype.watchImage = function (image) {
        if (this.loadedUrls.has(image.dataset.src)) {
            this.loadImage(image);
        } else if (this.observer) {
            this.observer.observe(image);
        } else {
            this.loadImage(image);
        }
    };

    LazyVirtualList.prototype.onIntersect = function (entries) {
        var self = this;
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            self.loadImage(entry.target);
            self.observer.unobserve(entry.target);
        });
    };

    LazyVirtualList.prototype.loadImage = function (image) {
        var url = image.dataset.src;
        if (!url || image.hasAttribute('src')) return;
        image.src = url;
        this.loadedUrls.add(url);
        image.classList.add('is-loaded');
    };

    LazyVirtualList.prototype.destroy = function () {
        this.container.removeEventListener('scroll', this.onScroll);
        if (this.observer) this.observer.disconnect();
        if (this.frame) global.cancelAnimationFrame(this.frame);
        this.content.remove();
    };

    global.LazyVirtualList = LazyVirtualList;
})(window);
