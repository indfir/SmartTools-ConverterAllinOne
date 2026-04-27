// SmartTools - Universal File Converter (Desktop Edition)

// Detect environment
var isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
var isHTA = typeof window !== 'undefined' && window.HTAFileSystem;

var state = {
    currentPage: 'home',
    currentConvertTarget: 'word',
    currentOrganizeAction: 'merge',
    currentCompressLevel: 'medium',
    uploadedFiles: [],
    detectedSourceType: null,
    processedBlob: null,
    processedFilename: null,
    isElectron: isElectron,
    isHTA: isHTA
};

var COMPRESS_PRESETS = {
    low:    { scale: 2.0, quality: 0.85 },
    medium: { scale: 1.5, quality: 0.65 },
    high:   { scale: 1.1, quality: 0.45 }
};

// Supported source extensions and their display info
var SOURCE_TYPES = {
    pdf:  { exts: ['pdf'],  label: 'PDF',  badgeClass: 'badge-pdf',  icon: 'ph-file-pdf' },
    doc:  { exts: ['docx'], label: 'DOC',  badgeClass: 'badge-doc',  icon: 'ph-file-doc' },
    xls:  { exts: ['xlsx', 'xls', 'csv'], label: 'XLS', badgeClass: 'badge-xls', icon: 'ph-file-xls' },
    ppt:  { exts: ['pptx'], label: 'PPT',  badgeClass: 'badge-ppt',  icon: 'ph-file-ppt' },
    img:  { exts: ['png', 'jpg', 'jpeg'], label: 'IMG', badgeClass: 'badge-png', icon: 'ph-image' },
    txt:  { exts: ['txt', 'md'], label: 'TXT',  badgeClass: 'badge-txt',  icon: 'ph-text-t' }
};

// File input accept string for all supported types
var ALL_ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.pptx,.png,.jpg,.jpeg,.txt,.md';

// Compress-acceptable file types (PDF, images, text)
var COMPRESS_ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt';

function safeRun(name, fn) {
    try { fn(); console.log('[PDFKit] ' + name + ' OK'); }
    catch (e) { console.error('[PDFKit] ' + name + ' failed:', e); }
}

// Get source type key from filename extension
function getSourceType(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    for (var key in SOURCE_TYPES) {
        if (SOURCE_TYPES[key].exts.indexOf(ext) !== -1) return key;
    }
    return null;
}

// Get extension from filename
function getExt(filename) {
    return (filename.split('.').pop() || '').toLowerCase();
}

function baseName(filename) {
    return filename.replace(/\.[^.]+$/, '');
}

// Parse page range string like "1, 3, 5-7" into 0-based indices, clamped to [0, total-1]
function parsePageRanges(str, total) {
    var indices = [];
    str.split(',').forEach(function(part) {
        part = part.trim();
        var range = part.match(/^(\d+)\s*-\s*(\d+)$/);
        if (range) {
            var from = parseInt(range[1], 10), to = parseInt(range[2], 10);
            for (var i = from; i <= to; i++) {
                if (i >= 1 && i <= total && indices.indexOf(i - 1) === -1) indices.push(i - 1);
            }
        } else {
            var n = parseInt(part, 10);
            if (!isNaN(n) && n >= 1 && n <= total && indices.indexOf(n - 1) === -1) indices.push(n - 1);
        }
    });
    return indices.sort(function(a, b) { return a - b; });
}

function changeExt(filename, newExt) {
    if (/\.[^.]+$/.test(filename)) return filename.replace(/\.[^.]+$/, '.' + newExt);
    return filename + '.' + newExt;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('[SmartTools] DOM ready, initializing...');
    console.log('[SmartTools] Running in Electron:', isElectron);
    
    safeRun('setupNavigation', setupNavigation);
    safeRun('setupThemeToggle', setupThemeToggle);
    safeRun('setupFormatSelection', setupFormatSelection);
    safeRun('setupActionTabs', setupActionTabs);
    safeRun('setupCompress', setupCompress);
    safeRun('setupConvert', setupConvert);
    safeRun('setupOrganize', setupOrganize);
    safeRun('setupEdit', setupEdit);
    safeRun('setupSign', setupSign);
    safeRun('setupAiChat', setupAiChat);
    safeRun('setupAiSummarize', setupAiSummarize);
    safeRun('setupDownload', setupDownload);
    safeRun('setupElectron', setupElectron);
    
    console.log('[SmartTools] init complete. Libs:',
        'PDFLib=' + (typeof PDFLib !== 'undefined'),
        'pdfjs=' + (typeof pdfjsLib !== 'undefined'),
        'JSZip=' + (typeof JSZip !== 'undefined'),
        'XLSX=' + (typeof XLSX !== 'undefined'),
        'docx=' + (typeof docx !== 'undefined'),
        'PptxGenJS=' + (typeof PptxGenJS !== 'undefined'));
});

// ---------- Desktop Setup (Electron/HTA) ----------
function setupElectron() {
    if (isElectron) {
        console.log('[SmartTools] Setting up Electron integration...');
        
        // Handle files dropped from OS
        window.electronAPI.onFilesDropped(function(filePaths) {
            console.log('[SmartTools] Files dropped:', filePaths);
        });
        
        // Handle open file dialog from menu
        window.electronAPI.onOpenFileDialog(function() {
            var activeInput = document.querySelector('.page-content.active input[type="file"]');
            if (activeInput) activeInput.click();
        });
        
        document.title = 'SmartTools - Universal File Converter';
    }
    
    if (isHTA) {
        console.log('[SmartTools] Running in HTA mode');
        document.title = 'SmartTools - Universal File Converter';
    }
}

// ---------- Navigation ----------
window.switchPage = function(pageName) {
    state.currentPage = pageName;
    document.querySelectorAll('.nav-item[data-page]').forEach(function(item) {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
    document.querySelectorAll('.page-content').forEach(function(page) {
        page.classList.toggle('active', page.id === 'page-' + pageName);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            switchPage(this.dataset.page);
        });
    });
    
    // Category filter nav items
    document.querySelectorAll('.nav-item[data-category]').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var catId = this.dataset.category;
            filterCategory(catId, this);
        });
    });
    
    document.querySelectorAll('.tool-card[data-page]').forEach(function(card) {
        card.addEventListener('click', function() { switchPage(this.dataset.page); });
    });
    document.querySelectorAll('.quick-action-card[data-page]').forEach(function(action) {
        action.addEventListener('click', function() { switchPage(this.dataset.page); });
    });
}

// Category filtering function
function filterCategory(catId, clickedNav) {
    // Update active nav state
    document.querySelectorAll('.nav-item[data-category]').forEach(function(item) {
        item.classList.remove('active');
    });
    clickedNav.classList.add('active');
    
    // Switch to home page if not already there
    if (state.currentPage !== 'home') {
        switchPage('home');
    }
    
    var dashboard = document.querySelector('.everytools-dashboard');
    var categories = document.querySelectorAll('.et-category');
    
    if (catId === 'all') {
        // Show all categories
        categories.forEach(function(cat) {
            cat.classList.remove('hidden');
            cat.classList.add('visible');
        });
        // Hide filter header
        var filterHeader = document.querySelector('.filter-header');
        if (filterHeader) filterHeader.classList.remove('active');
    } else {
        // Show only selected category
        categories.forEach(function(cat) {
            if (cat.id === catId) {
                cat.classList.remove('hidden');
                cat.classList.add('visible');
            } else {
                cat.classList.add('hidden');
                cat.classList.remove('visible');
            }
        });
        
        // Show filter header with clear button
        var filterHeader = document.querySelector('.filter-header');
        if (!filterHeader) {
            // Create filter header
            filterHeader = document.createElement('div');
            filterHeader.className = 'filter-header';
            filterHeader.innerHTML = 
                '<span class="filter-header-title" id="filter-title"></span>' +
                '<span class="filter-header-count" id="filter-count"></span>' +
                '<button class="filter-clear-btn" onclick="clearFilter()">' +
                '<i class="ph ph-x"></i> Clear filter' +
                '</button>';
            dashboard.insertBefore(filterHeader, dashboard.firstChild);
        }
        filterHeader.classList.add('active');
        
        // Update filter header info
        var catTitle = document.querySelector('#' + catId + ' .et-cat-title');
        var filterTitle = document.getElementById('filter-title');
        var filterCount = document.getElementById('filter-count');
        if (catTitle && filterTitle) {
            filterTitle.textContent = catTitle.textContent.trim();
        }
        if (filterCount) {
            var cardCount = document.querySelectorAll('#' + catId + ' .et-card').length;
            filterCount.textContent = cardCount + ' tools';
        }
    }
    
    // Scroll to top of dashboard
    if (dashboard) {
        dashboard.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Clear filter function
window.clearFilter = function() {
    var workspaceNav = document.querySelector('.nav-item[data-category="all"]');
    if (workspaceNav) {
        filterCategory('all', workspaceNav);
    }
};

function setupThemeToggle() {
    // Apply saved theme on load
    var saved = localStorage.getItem('smarttools-theme') || 'light';
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    var cb = document.getElementById('theme-toggle-cb');
    if (!cb) return;
    cb.checked = (saved === 'dark');
    cb.addEventListener('change', function() {
        if (cb.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('smarttools-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('smarttools-theme', 'light');
        }
    });
}

// ---------- Compress Page (Unified) ----------
function setupCompress() {
    var uploadZone = document.getElementById('compress-upload');
    var fileInput = document.getElementById('compress-file-input');
    var uploadBtn = uploadZone.querySelector('.btn-upload');
    var processBtn = document.getElementById('compress-process-btn');
    var filePreview = document.getElementById('compress-preview');
    var uploadContent = uploadZone.querySelector('.upload-zone-content');
    var thumbContainer = document.getElementById('compress-thumb');
    var fileNameEl = document.getElementById('compress-file-name');
    var fileSizeEl = document.getElementById('compress-file-size');
    var fileTypeEl = document.getElementById('compress-file-type');
    var changeBtn = document.getElementById('compress-change-file');
    var removeBtn = document.getElementById('compress-remove-file');
    var errorEl = document.getElementById('compress-upload-error');
    
    var currentFile = null;
    var validExts = ['pdf', 'png', 'jpg', 'jpeg', 'txt'];
    
    fileInput.setAttribute('accept', COMPRESS_ACCEPT);
    
    function showFilePreview(file) {
        currentFile = file;
        uploadContent.style.display = 'none';
        filePreview.style.display = '';
        errorEl.style.display = 'none';
        
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = formatFileSize(file.size);
        
        var ext = file.name.split('.').pop().toLowerCase();
        var typeLabels = { pdf: 'PDF', png: 'PNG', jpg: 'JPG', jpeg: 'JPG', txt: 'TXT' };
        fileTypeEl.textContent = typeLabels[ext] || ext.toUpperCase();
        
        // Show thumbnail for images
        if (file.type.startsWith('image/')) {
            var reader = new FileReader();
            reader.onload = function(e) {
                thumbContainer.innerHTML = '<img src="' + e.target.result + '" alt="Preview" />';
            };
            reader.readAsDataURL(file);
        } else if (ext === 'pdf') {
            thumbContainer.innerHTML = '<div class="thumb-placeholder"><i class="ph ph-file-pdf"></i></div>';
            // Try to render PDF thumbnail
            file.arrayBuffer().then(function(data) {
                return pdfjsLib.getDocument({ data: data }).promise;
            }).then(function(pdf) {
                return pdf.getPage(1);
            }).then(function(page) {
                var viewport = page.getViewport({ scale: 0.3 });
                var canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                var ctx = canvas.getContext('2d');
                return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
                    thumbContainer.innerHTML = '';
                    thumbContainer.appendChild(canvas);
                });
            }).catch(function() {
                // Keep placeholder if PDF render fails
            });
        } else {
            thumbContainer.innerHTML = '<div class="thumb-placeholder"><i class="ph ph-file-text"></i></div>';
        }
    }
    
    function resetUpload() {
        currentFile = null;
        fileInput.value = '';
        uploadContent.style.display = '';
        filePreview.style.display = 'none';
        errorEl.style.display = 'none';
        state.uploadedFiles = [];
    }
    
    function showError(message) {
        errorEl.querySelector('span').textContent = message;
        errorEl.style.display = 'flex';
    }
    
    // Upload button
    uploadBtn.addEventListener('click', function(e) { e.stopPropagation(); fileInput.click(); });
    
    // Change file button
    if (changeBtn) {
        changeBtn.addEventListener('click', function(e) { e.stopPropagation(); fileInput.click(); });
    }
    
    // Remove file button
    if (removeBtn) {
        removeBtn.addEventListener('click', function(e) { e.stopPropagation(); resetUpload(); });
    }
    
    // File input change
    fileInput.addEventListener('change', function() {
        var files = Array.from(this.files);
        if (files.length > 0) {
            var file = files[0];
            var ext = file.name.split('.').pop().toLowerCase();
            if (validExts.indexOf(ext) === -1) {
                showError('Invalid file type. Please upload PDF, PNG, JPG, or TXT files.');
                return;
            }
            state.uploadedFiles = files;
            showFilePreview(file);
            showCompressSourceBadge(getSourceType(file.name));
        }
    });
    
    // Drag and drop
    uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', function(e) { e.preventDefault(); uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault(); uploadZone.classList.remove('dragover');
        var files = Array.from(e.dataTransfer.files).filter(function(f) {
            return /\.(pdf|png|jpe?g|txt)$/i.test(f.name);
        });
        if (files.length > 0) {
            var file = files[0];
            state.uploadedFiles = files;
            showFilePreview(file);
        } else {
            showError('Invalid file type. Please upload PDF, PNG, JPG, or TXT files.');
        }
    });
    
    // Process button
    processBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (currentFile) {
            processUnifiedCompress(currentFile).catch(function(err) {
                hideProcessing(); alert('Error: ' + err.message);
            });
        } else { alert('Silakan upload file terlebih dahulu.'); }
    });
}

function showCompressSourceBadge(sourceType) {
    var container = document.getElementById('compress-source-detected');
    var badge = document.getElementById('compress-source-badge');
    if (!container || !badge) return;
    if (sourceType && SOURCE_TYPES[sourceType]) {
        var info = SOURCE_TYPES[sourceType];
        badge.textContent = info.label;
        badge.className = 'format-badge ' + info.badgeClass;
        container.style.display = 'inline-flex';
    } else {
        container.style.display = 'none';
    }
}

// ---------- Convert Page (Unified) ----------
function setupConvert() {
    var uploadZone = document.getElementById('convert-upload');
    var fileInput = document.getElementById('convert-file-input');
    var uploadBtn = document.getElementById('convert-select-btn');
    var uploadContent = uploadZone.querySelector('.upload-zone-content');

    // Accept all supported file types
    fileInput.setAttribute('accept', ALL_ACCEPT);

    uploadBtn.addEventListener('click', function(e) { e.stopPropagation(); fileInput.click(); });
    uploadZone.addEventListener('click', function(e) {
        if (uploadZone.querySelector('.file-preview')) return;
        if (e.target === fileInput) return;
        fileInput.click();
    });
    fileInput.addEventListener('change', function() {
        var files = Array.from(this.files);
        if (files.length > 0) {
            state.uploadedFiles = files;
            state.detectedSourceType = getSourceType(files[0].name);
            showSourceBadge(state.detectedSourceType);
            showConvertPreview(files, uploadZone, uploadContent);
        }
    });
    uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', function() { uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault(); uploadZone.classList.remove('dragover');
        var files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            state.uploadedFiles = files;
            state.detectedSourceType = getSourceType(files[0].name);
            showSourceBadge(state.detectedSourceType);
            showConvertPreview(files, uploadZone, uploadContent);
        }
    });
}

function showSourceBadge(sourceType) {
    var container = document.getElementById('source-detected');
    var badge = document.getElementById('source-badge');
    if (!container || !badge) return;

    if (sourceType && SOURCE_TYPES[sourceType]) {
        var info = SOURCE_TYPES[sourceType];
        badge.textContent = info.label;
        badge.className = 'format-badge ' + info.badgeClass;
        container.style.display = 'inline-flex';
    } else {
        container.style.display = 'none';
    }
}

function showConvertPreview(files, zone, uploadContent) {
    var existing = zone.querySelector('.file-preview');
    if (existing) existing.remove();

    var preview = document.createElement('div');
    preview.className = 'file-preview';
    var fileListDiv = document.createElement('div');
    fileListDiv.className = 'file-list';

    for (var i = 0; i < files.length; i++) {
        (function(file) {
            var st = getSourceType(file.name);
            var iconClass = st && SOURCE_TYPES[st] ? SOURCE_TYPES[st].icon : 'ph-file';
            var item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML =
                '<div class="file-item-icon"><i class="ph ' + iconClass + '"></i></div>' +
                '<div class="file-item-info"><div class="file-item-name"></div>' +
                '<div class="file-item-size"></div></div>' +
                '<button class="file-item-remove"><i class="ph ph-x"></i></button>';
            item.querySelector('.file-item-name').textContent = file.name;
            item.querySelector('.file-item-size').textContent = formatFileSize(file.size);
            item.querySelector('.file-item-remove').addEventListener('click', function(ev) {
                ev.stopPropagation();
                preview.remove();
                uploadContent.style.display = 'block';
                state.uploadedFiles = [];
                state.detectedSourceType = null;
                showSourceBadge(null);
                document.getElementById('convert-file-input').value = '';
            });
            fileListDiv.appendChild(item);
        })(files[i]);
    }

    var actions = document.createElement('div');
    actions.className = 'action-buttons';
    var processBtn = document.createElement('button');
    processBtn.className = 'btn-process';
    processBtn.innerHTML = '<i class="ph ph-gear"></i> Process';
    processBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (state.uploadedFiles.length > 0) {
            processUnifiedConvert(state.uploadedFiles[0]).catch(function(err) {
                hideProcessing(); alert('Error: ' + err.message);
            });
        }
    });
    actions.appendChild(processBtn);
    preview.appendChild(fileListDiv);
    preview.appendChild(actions);
    zone.appendChild(preview);
    uploadContent.style.display = 'none';
}

// ---------- Organize Page ----------
function setupOrganize() {
    var uploadZone = document.getElementById('organize-upload');
    var fileInput = document.getElementById('organize-file-input');
    var uploadBtn = uploadZone.querySelector('.btn-upload');
    var uploadContent = uploadZone.querySelector('.upload-zone-content');
    var mergeView = document.getElementById('merge-view');
    var mergeContainer = document.getElementById('merge-files-container');
    var mergeFileCount = document.getElementById('merge-file-count');
    var mergeProcessBtn = document.getElementById('merge-process-btn');
    var mergeAddMoreBtn = document.getElementById('merge-add-more-btn');
    
    var uploadedFiles = [];
    var filePageCounts = {};
    
    function showMergeView() {
        uploadZone.style.display = 'none';
        mergeView.style.display = 'flex';
        renderMergeFiles();
    }
    
    function hideMergeView() {
        uploadZone.style.display = '';
        mergeView.style.display = 'none';
    }
    
    function renderMergeFiles() {
        mergeContainer.innerHTML = '';
        mergeFileCount.textContent = uploadedFiles.length + ' file' + (uploadedFiles.length !== 1 ? 's' : '');
        
        uploadedFiles.forEach(function(file, index) {
            // Add file item
            var item = document.createElement('div');
            item.className = 'merge-file-item';
            item.draggable = true;
            item.dataset.index = index;
            
            var thumbDiv = document.createElement('div');
            thumbDiv.className = 'merge-file-thumb';
            thumbDiv.innerHTML = '<div class="thumb-placeholder"><i class="ph ph-file-pdf"></i></div>';
            
            var checkbox = document.createElement('div');
            checkbox.className = 'merge-file-checkbox';
            checkbox.title = 'Select';
            
            var removeBtn = document.createElement('button');
            removeBtn.className = 'merge-file-remove';
            removeBtn.innerHTML = '<i class="ph ph-x"></i>';
            removeBtn.title = 'Remove';
            
            thumbDiv.appendChild(checkbox);
            thumbDiv.appendChild(removeBtn);
            
            var infoDiv = document.createElement('div');
            infoDiv.className = 'merge-file-info';
            
            var nameDiv = document.createElement('div');
            nameDiv.className = 'merge-file-name';
            nameDiv.textContent = file.name;
            nameDiv.title = file.name;
            
            var pagesDiv = document.createElement('div');
            pagesDiv.className = 'merge-file-pages';
            pagesDiv.textContent = filePageCounts[file.name] ? filePageCounts[file.name] + ' page' + (filePageCounts[file.name] !== 1 ? 's' : '') : 'Loading...';
            
            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(pagesDiv);
            
            item.appendChild(thumbDiv);
            item.appendChild(infoDiv);
            
            // Render PDF thumbnail
            renderPdfThumbnail(file, thumbDiv, pagesDiv);
            
            // Remove button
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                uploadedFiles.splice(index, 1);
                delete filePageCounts[file.name];
                if (uploadedFiles.length === 0) {
                    hideMergeView();
                } else {
                    renderMergeFiles();
                }
            });
            
            // Drag events
            item.addEventListener('dragstart', function(e) {
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
            });
            
            item.addEventListener('dragend', function() {
                item.classList.remove('dragging');
            });
            
            mergeContainer.appendChild(item);
            
            // Add "+" button between items (not after last)
            if (index < uploadedFiles.length - 1) {
                var addBetween = document.createElement('div');
                addBetween.className = 'merge-add-between';
                var addBtn = document.createElement('button');
                addBtn.className = 'merge-add-btn';
                addBtn.innerHTML = '<i class="ph ph-plus"></i>';
                addBtn.title = 'Insert file here';
                addBtn.addEventListener('click', function() {
                    fileInput.click();
                    fileInput.dataset.insertIndex = index + 1;
                });
                addBetween.appendChild(addBtn);
                mergeContainer.appendChild(addBetween);
            }
        });
        
        // Add "Add files" button at end
        var addEnd = document.createElement('div');
        addEnd.className = 'merge-add-end';
        addEnd.innerHTML = '<i class="ph ph-plus"></i><span>Add more PDF files</span>';
        addEnd.addEventListener('click', function() {
            fileInput.click();
            fileInput.dataset.insertIndex = '';
        });
        mergeContainer.appendChild(addEnd);
        
        // Setup drag and drop reordering
        setupMergeDragReorder();
    }
    
    function renderPdfThumbnail(file, thumbDiv, pagesDiv) {
        file.arrayBuffer().then(function(data) {
            return pdfjsLib.getDocument({ data: data }).promise;
        }).then(function(pdf) {
            filePageCounts[file.name] = pdf.numPages;
            if (pagesDiv) {
                pagesDiv.textContent = pdf.numPages + ' page' + (pdf.numPages !== 1 ? 's' : '');
            }
            return pdf.getPage(1);
        }).then(function(page) {
            var viewport = page.getViewport({ scale: 0.6 });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');
            return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
                thumbDiv.innerHTML = '';
                var checkbox = document.createElement('div');
                checkbox.className = 'merge-file-checkbox';
                checkbox.title = 'Select';
                var removeBtn = document.createElement('button');
                removeBtn.className = 'merge-file-remove';
                removeBtn.innerHTML = '<i class="ph ph-x"></i>';
                removeBtn.title = 'Remove';
                thumbDiv.appendChild(canvas);
                thumbDiv.appendChild(checkbox);
                thumbDiv.appendChild(removeBtn);
                
                // Re-attach remove handler
                removeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var idx = Array.from(mergeContainer.querySelectorAll('.merge-file-item')).indexOf(
                        thumbDiv.closest('.merge-file-item')
                    );
                    if (idx >= 0) {
                        uploadedFiles.splice(idx, 1);
                        if (uploadedFiles.length === 0) {
                            hideMergeView();
                        } else {
                            renderMergeFiles();
                        }
                    }
                });
            });
        }).catch(function(err) {
            console.warn('Thumbnail error:', err);
        });
    }
    
    function setupMergeDragReorder() {
        var container = mergeContainer;
        var draggedItem = null;
        var draggedIndex = -1;
        
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            var target = e.target.closest('.merge-file-item');
            if (target && target !== draggedItem) {
                var rect = target.getBoundingClientRect();
                var midX = rect.left + rect.width / 2;
                if (e.clientX < midX) {
                    container.insertBefore(draggedItem, target);
                } else {
                    container.insertBefore(draggedItem, target.nextSibling);
                }
            }
        });
        
        container.addEventListener('drop', function(e) {
            e.preventDefault();
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                // Rebuild uploadedFiles array based on new DOM order
                var newOrder = [];
                container.querySelectorAll('.merge-file-item').forEach(function(item) {
                    var idx = parseInt(item.dataset.index);
                    newOrder.push(uploadedFiles[idx]);
                });
                uploadedFiles = newOrder;
                renderMergeFiles();
            }
        });
        
        container.addEventListener('dragstart', function(e) {
            draggedItem = e.target.closest('.merge-file-item');
            if (draggedItem) {
                draggedIndex = parseInt(draggedItem.dataset.index);
            }
        });
        
        container.addEventListener('dragend', function() {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
            }
        });
    }
    
    // Upload button
    uploadBtn.addEventListener('click', function(e) { e.stopPropagation(); fileInput.click(); });
    
    // Add more button
    if (mergeAddMoreBtn) {
        mergeAddMoreBtn.addEventListener('click', function() { fileInput.click(); fileInput.dataset.insertIndex = ''; });
    }
    
    // File input change
    fileInput.addEventListener('change', function() {
        var files = Array.from(this.files);
        if (files.length > 0) {
            var insertIdx = fileInput.dataset.insertIndex;
            if (insertIdx !== '' && !isNaN(parseInt(insertIdx))) {
                // Insert at specific position
                var idx = parseInt(insertIdx);
                uploadedFiles.splice.apply(uploadedFiles, [idx, 0].concat(files));
            } else {
                // Append to end
                uploadedFiles = uploadedFiles.concat(files);
            }
            showMergeView();
            fileInput.value = '';
            fileInput.dataset.insertIndex = '';
        }
    });
    
    // Drag and drop on upload zone
    uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', function() { uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault(); uploadZone.classList.remove('dragover');
        var files = Array.from(e.dataTransfer.files).filter(function(f) { return /\.pdf$/i.test(f.name); });
        if (files.length > 0) {
            uploadedFiles = uploadedFiles.concat(files);
            showMergeView();
        }
    });
    
    // Process button
    mergeProcessBtn.addEventListener('click', function() {
        if (uploadedFiles.length < 2) {
            alert('Please add at least 2 PDF files to merge.');
            return;
        }
        processOrganize(uploadedFiles).catch(function(err) { hideProcessing(); alert('Error: ' + err.message); });
    });
}

// ---------- Format Selection ----------
function setupFormatSelection() {
    document.querySelectorAll('.format-card[data-convert-target]').forEach(function(card) {
        card.addEventListener('click', function() {
            var parent = card.closest('.format-grid');
            if (parent) parent.querySelectorAll('.format-card').forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            state.currentConvertTarget = this.dataset.convertTarget;
        });
    });
    document.querySelectorAll('.format-card[data-compress]').forEach(function(card) {
        card.addEventListener('click', function() {
            var parent = card.closest('.format-grid');
            if (parent) parent.querySelectorAll('.format-card').forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            state.currentCompressLevel = this.dataset.compress;
        });
    });
}

var currentRotateAngle = 90; // Default rotation angle (used in processOrganize legacy code)
var pageRotations = {}; // Track per-page rotations

function setupActionTabs() {
    // No action tabs remain in Organize (Merge-only) — kept as no-op for safety
}

async function renderPagePreviews(file) {
    try { ensurePdfJs(); } catch(e) { return; }
    
    // Find the file preview container
    var uploadZone = document.getElementById('organize-upload');
    var preview = uploadZone ? uploadZone.querySelector('.file-preview') : null;
    if (!preview) return;
    
    // Remove existing page preview if any
    var existingGrid = preview.querySelector('.page-preview-grid');
    if (existingGrid) existingGrid.remove();
    
    // Create page preview grid
    var grid = document.createElement('div');
    grid.className = 'page-preview-grid';
    grid.style.marginTop = '16px';
    grid.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Loading preview...</div>';
    preview.appendChild(grid);

    try {
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        grid.innerHTML = '';
        pageRotations = {};

        for (var i = 1; i <= pdf.numPages; i++) {
            pageRotations[i] = 0; // Initialize rotation to 0
            var page = await pdf.getPage(i);
            var viewport = page.getViewport({ scale: 1.5 });
            var canvas = document.createElement('canvas');
            canvas.id = 'page-canvas-' + i;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            var item = document.createElement('div');
            item.className = 'page-preview-item';
            item.innerHTML =
                '<span class="page-angle-badge" id="angle-badge-' + i + '">0°</span>' +
                '<button class="page-rotate-btn" data-page="' + i + '" title="Rotate 90° CW"><i class="ph ph-arrow-clockwise"></i></button>' +
                '<canvas></canvas>' +
                '<span class="page-preview-label">Page ' + i + '</span>';

            var canvasEl = item.querySelector('canvas');
            canvasEl.replaceWith(canvas);

            grid.appendChild(item);
        }

        // Setup per-page rotation buttons
        grid.querySelectorAll('.page-rotate-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var pageIndex = parseInt(this.dataset.page);
                rotateSinglePage(pageIndex, pdf);
            });
        });

    } catch (error) {
        grid.innerHTML = '<div style="color: var(--danger); padding: 20px;">Error loading preview: ' + error.message + '</div>';
    }
}

function applyRotationToAllPreviews(angle) {
    // Apply rotation to all page previews
    // Search for grid inside file-preview inside organize-upload
    var uploadZone = document.getElementById('organize-upload');
    if (!uploadZone) return;
    
    var filePreview = uploadZone.querySelector('.file-preview');
    if (!filePreview) return;
    
    var grid = filePreview.querySelector('.page-preview-grid');
    if (!grid) return;
    
    grid.querySelectorAll('.page-preview-item').forEach(function(item) {
        var canvas = item.querySelector('canvas');
        if (!canvas) return;
        
        // Apply CSS transform for visual rotation
        canvas.style.transform = 'rotate(' + angle + 'deg)';
        canvas.style.transition = 'transform 0.3s ease';
        
        // Update the angle badge
        var badge = item.querySelector('.page-angle-badge');
        if (badge) badge.textContent = angle + '°';
    });
    
    // Update all page rotation values
    for (var key in pageRotations) {
        pageRotations[key] = angle;
    }
}

async function rotateSinglePage(pageIndex, pdf) {
    pageRotations[pageIndex] = (pageRotations[pageIndex] + 90) % 360;
    var angle = pageRotations[pageIndex];

    // Update badge
    var badge = document.getElementById('angle-badge-' + pageIndex);
    if (badge) badge.textContent = angle + '°';

    // Re-render page with rotation
    var canvas = document.getElementById('page-canvas-' + pageIndex);
    if (!canvas) return;

    var page = await pdf.getPage(pageIndex);
    var viewport = page.getViewport({ scale: 1.5 });

    // Calculate new dimensions if rotated 90 or 270 degrees
    var isRotated = (angle === 90 || angle === 270);
    canvas.width = isRotated ? viewport.height : viewport.width;
    canvas.height = isRotated ? viewport.width : viewport.height;

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    if (angle === 90) {
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
    } else if (angle === 180) {
        ctx.translate(canvas.width, canvas.height);
        ctx.rotate(Math.PI);
    } else if (angle === 270) {
        ctx.translate(0, canvas.height);
        ctx.rotate(-Math.PI / 2);
    }

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    ctx.restore();
}

// ---------- Download ----------
function setupDownload() {
    var btnDownload = document.getElementById('btn-download');
    btnDownload.addEventListener('click', async function() {
        if (!state.processedBlob) return;
        
        if (isElectron) {
            // Use Electron native save dialog
            try {
                var arrayBuffer = await state.processedBlob.arrayBuffer();
                var uint8Array = new Uint8Array(arrayBuffer);
                var result = await window.electronAPI.saveDownload(Array.from(uint8Array), state.processedFilename || 'converted.pdf');
                if (result.success) {
                    closeModals();
                }
            } catch (e) {
                console.error('Save failed:', e);
            }
        } else if (isHTA && window.HTAFileSystem) {
            // Use HTA file system
            try {
                var arrayBuffer = await state.processedBlob.arrayBuffer();
                window.HTAFileSystem.saveFileDialog(state.processedFilename || 'converted.pdf', arrayBuffer);
                closeModals();
            } catch (e) {
                console.error('Save failed:', e);
                // Fallback to browser download
                fallbackDownload();
            }
        } else {
            // Browser download (fallback)
            fallbackDownload();
        }
        
        function fallbackDownload() {
            var url = URL.createObjectURL(state.processedBlob);
            var a = document.createElement('a');
            a.href = url;
            a.download = state.processedFilename || 'converted.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
            closeModals();
        }
    });
}

// ---------- Helpers ----------
function showFileList(files, container) {
    container.innerHTML = '';
    for (var i = 0; i < files.length; i++) {
        (function(file, idx) {
            var item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = '<div class="file-item-icon"><i class="ph ph-file-pdf"></i></div>' +
                '<div class="file-item-info"><div class="file-item-name"></div><div class="file-item-size"></div></div>' +
                '<button class="file-item-remove"><i class="ph ph-x"></i></button>';
            item.querySelector('.file-item-name').textContent = file.name;
            item.querySelector('.file-item-size').textContent = formatFileSize(file.size);
            item.querySelector('.file-item-remove').addEventListener('click', function(e) {
                e.stopPropagation();
                item.remove();
            });
            container.appendChild(item);
        })(files[i], i);
    }
}

// Stub for legacy onclick references
window.removeCompressFile = function() {};

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ---------- PDF.js helpers ----------
function ensurePdfJs() {
    if (typeof pdfjsLib === 'undefined' && typeof window['pdfjs-dist/build/pdf'] !== 'undefined') {
        window.pdfjsLib = window['pdfjs-dist/build/pdf'];
    }
    if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js not loaded. Check your internet connection.');
}

async function extractPdfText(file, onProgress) {
    ensurePdfJs();
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var pages = [];
    for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var tc = await page.getTextContent();
        var lines = [], currentY = null, currentLine = [];
        tc.items.forEach(function(it) {
            var y = Math.round(it.transform[5]);
            if (currentY === null || Math.abs(y - currentY) < 2) { currentLine.push(it.str); currentY = y; }
            else { lines.push(currentLine.join(' ')); currentLine = [it.str]; currentY = y; }
        });
        if (currentLine.length) lines.push(currentLine.join(' '));
        pages.push(lines.join('\n').replace(/[ \t]+/g, ' ').trim());
        if (onProgress) onProgress(i, pdf.numPages);
    }
    return pages;
}

async function extractPdfPagesRich(file, scale) {
    ensurePdfJs(); scale = scale || 1.5;
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var pages = [];
    for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var tc = await page.getTextContent();
        var lines = [], currentY = null, currentLine = [];
        tc.items.forEach(function(it) {
            var y = Math.round(it.transform[5]);
            if (currentY === null || Math.abs(y - currentY) < 2) { currentLine.push(it.str); currentY = y; }
            else { lines.push(currentLine.join(' ')); currentLine = [it.str]; currentY = y; }
        });
        if (currentLine.length) lines.push(currentLine.join(' '));
        var text = lines.join('\n').replace(/[ \t]+/g, ' ').trim();
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        var pngBlob = await canvasToBlob(canvas, 'image/png');
        var pngBuffer = await pngBlob.arrayBuffer();
        pages.push({ text: text, imageBuffer: pngBuffer, imageWidth: canvas.width, imageHeight: canvas.height });
        canvas.width = 0; canvas.height = 0;
    }
    return pages;
}

function totalTextLength(pages) {
    return pages.reduce(function(s, p) { return s + (typeof p === 'string' ? p.length : (p.text || '').length); }, 0);
}

async function renderPdfPagesToCanvas(file, scale, onProgress) {
    ensurePdfJs(); scale = scale || 2;
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var canvases = [];
    for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        var ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        canvases.push(canvas);
        if (onProgress) onProgress(i, pdf.numPages);
    }
    return canvases;
}

function canvasToBlob(canvas, type, quality) {
    return new Promise(function(resolve) { canvas.toBlob(function(b) { resolve(b); }, type || 'image/png', quality); });
}

// ---------- Processing: Unified Compress ----------
function dataUrlToUint8(dataUrl) {
    var base64 = dataUrl.split(',')[1], binary = atob(base64), len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function cleanCompressedName(name) {
    return 'compressed_' + name.replace(/^(compressed_)+/i, '');
}

// Unified compress dispatcher for all file types
async function processUnifiedCompress(file) {
    var ext = getExt(file.name);
    var sourceType = getSourceType(file.name);

    if (sourceType === 'pdf') {
        return processCompressPdf(file);
    } else if (sourceType === 'img') {
        return processCompressImage(file, ext);
    } else if (sourceType === 'txt') {
        return processCompressText(file);
    } else {
        throw new Error('Unsupported format for compression: .' + ext);
    }
}

// Compress PDF
async function processCompressPdf(file) {
    var preset = COMPRESS_PRESETS[state.currentCompressLevel] || COMPRESS_PRESETS.medium;
    showProcessing('Compressing PDF...', 'Level: ' + state.currentCompressLevel);
    try {
        ensurePdfJs();
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        var newPdf = await PDFLib.PDFDocument.create();
        for (var i = 1; i <= pdf.numPages; i++) {
            var page = await pdf.getPage(i);
            var viewport = page.getViewport({ scale: preset.scale });
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            var jpegDataUrl = canvas.toDataURL('image/jpeg', preset.quality);
            var jpegBytes = dataUrlToUint8(jpegDataUrl);
            var jpgImage = await newPdf.embedJpg(jpegBytes);
            var newPage = newPdf.addPage([canvas.width, canvas.height]);
            newPage.drawImage(jpgImage, { x: 0, y: 0, width: canvas.width, height: canvas.height });
            canvas.width = 0; canvas.height = 0;
        }
        newPdf.setTitle(''); newPdf.setAuthor(''); newPdf.setSubject('');
        newPdf.setKeywords([]); newPdf.setProducer(''); newPdf.setCreator('');
        var compressedBytes = await newPdf.save({ useObjectStreams: true });
        var blob = new Blob([compressedBytes], { type: 'application/pdf' });
        hideProcessing();
        showSuccess('PDF compressed: ' + formatFileSize(compressedBytes.length), blob, cleanCompressedName(file.name));
    } catch (error) { hideProcessing(); alert('Error: ' + error.message); }
}

// Compress Image (PNG/JPG)
async function processCompressImage(file, ext) {
    var preset = COMPRESS_PRESETS[state.currentCompressLevel] || COMPRESS_PRESETS.medium;
    var quality = preset.quality;
    showProcessing('Compressing image...', 'Level: ' + state.currentCompressLevel);
    try {
        var img = new Image();
        var url = URL.createObjectURL(file);
        img.src = url;
        await new Promise(function(resolve, reject) {
            img.onload = resolve;
            img.onerror = reject;
        });
        URL.revokeObjectURL(url);

        var canvas = document.createElement('canvas');
        // Invert scale: low=least compression (scale near 1), high=most (scale ~0.5)
        var scaleMap = { low: 1.0, medium: 0.75, high: 0.5 };
        var scale = scaleMap[state.currentCompressLevel] || 0.75;
        canvas.width = Math.max(1, Math.floor(img.width * scale));
        canvas.height = Math.max(1, Math.floor(img.height * scale));
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        var compressedBlob;
        var outputExt = ext;
        if (ext === 'png') {
            // Keep PNG as PNG to preserve transparency
            compressedBlob = await canvasToBlob(canvas, 'image/png');
            outputExt = 'png';
        } else {
            compressedBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
            outputExt = 'jpg';
        }

        canvas.width = 0; canvas.height = 0;
        hideProcessing();
        var outName = baseName(file.name) + '_compressed.' + outputExt;
        showSuccess('Image compressed: ' + formatFileSize(compressedBlob.size), compressedBlob, outName);
    } catch (error) { hideProcessing(); alert('Error: ' + error.message); }
}

// Compress Text (remove whitespace, empty lines)
async function processCompressText(file) {
    showProcessing('Compressing text...', 'Removing extra whitespace');
    try {
        var text = await file.text();
        // Remove extra whitespace, empty lines, normalize line endings
        var compressed = text
            .replace(/\r\n/g, '\n')           // Normalize line endings
            .replace(/\n{3,}/g, '\n\n')       // Remove excessive blank lines
            .replace(/[ \t]+$/gm, '')         // Remove trailing whitespace
            .replace(/^[\s\n]+/, '')          // Remove leading whitespace/newlines
            .replace(/[\s\n]+$/, '');         // Remove trailing whitespace/newlines
        var blob = new Blob([compressed], { type: 'text/plain;charset=utf-8' });
        hideProcessing();
        showSuccess('Text compressed: ' + formatFileSize(blob.size), blob, baseName(file.name) + '_compressed.txt');
    } catch (error) { hideProcessing(); alert('Error: ' + error.message); }
}

// ---------- Unified Convert Dispatcher ----------
async function processUnifiedConvert(file) {
    var ext = getExt(file.name);
    var sourceType = getSourceType(file.name);
    var target = state.currentConvertTarget;
    var outputName, resultBlob;

    showProcessing('Converting...', getSourceTypeLabel(sourceType) + ' → ' + target.charAt(0).toUpperCase() + target.slice(1));

    try {
        // ---- SOURCE: PDF ----
        if (sourceType === 'pdf') {
            if (target === 'word') {
                var textPages = await extractPdfText(file);
                var richPages = totalTextLength(textPages) < 30
                    ? await extractPdfPagesRich(file, 1.5)
                    : textPages.map(function(t) { return { text: t, imageBuffer: null, imageWidth: 0, imageHeight: 0 }; });
                resultBlob = await buildDocxFromPages(richPages);
                outputName = changeExt(file.name, 'docx');
            } else if (target === 'excel') {
                var pages2 = await extractPdfText(file);
                if (totalTextLength(pages2) < 30) throw new Error('Image-based PDF. Excel cannot store images — try Word instead.');
                resultBlob = buildXlsxFromPages(pages2);
                outputName = changeExt(file.name, 'xlsx');
            } else if (target === 'ppt') {
                var textPages3 = await extractPdfText(file);
                var richPages3 = totalTextLength(textPages3) < 30
                    ? await extractPdfPagesRich(file, 1.5)
                    : textPages3.map(function(t) { return { text: t, imageBuffer: null, imageWidth: 0, imageHeight: 0 }; });
                resultBlob = await buildPptxFromPages(richPages3);
                outputName = changeExt(file.name, 'pptx');
            } else if (target === 'image') {
                var canvases = await renderPdfPagesToCanvas(file, 2);
                if (canvases.length === 1) {
                    resultBlob = await canvasToBlob(canvases[0], 'image/png');
                    outputName = changeExt(file.name, 'png');
                } else {
                    var zip = new JSZip();
                    for (var i = 0; i < canvases.length; i++) {
                        var b = await canvasToBlob(canvases[i], 'image/png');
                        zip.file(baseName(file.name) + '_page_' + (i + 1) + '.png', b);
                    }
                    resultBlob = await zip.generateAsync({ type: 'blob' });
                    outputName = baseName(file.name) + '_images.zip';
                }
            } else if (target === 'text') {
                var pages4 = await extractPdfText(file);
                if (totalTextLength(pages4) < 5) throw new Error('No text could be extracted — this is an image-based PDF.');
                var text = pages4.map(function(p, i) { return '=== Page ' + (i + 1) + ' ===\n' + p; }).join('\n\n');
                resultBlob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                outputName = changeExt(file.name, 'txt');
            } else if (target === 'pdf') {
                resultBlob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
                outputName = file.name;
            } else {
                throw new Error('Unrecognized target format: ' + target);
            }

        // ---- SOURCE: DOCX ----
        } else if (sourceType === 'doc') {
            if (target === 'pdf') {
                var docxText = await extractDocxText(file);
                resultBlob = await textToPdfBlob(docxText, baseName(file.name));
                outputName = changeExt(file.name, 'pdf');
            } else if (target === 'text') {
                var dText = await extractDocxText(file);
                resultBlob = new Blob([dText], { type: 'text/plain;charset=utf-8' });
                outputName = changeExt(file.name, 'txt');
            } else if (target === 'word') {
                resultBlob = new Blob([await file.arrayBuffer()], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                outputName = file.name;
            } else {
                throw new Error('DOCX can only be converted to PDF or Text.');
            }

        // ---- SOURCE: XLSX/XLS/CSV ----
        } else if (sourceType === 'xls') {
            if (target === 'pdf') {
                var sheetText = await extractSheetText(file);
                resultBlob = await textToPdfBlob(sheetText, baseName(file.name), { monospace: true });
                outputName = changeExt(file.name, 'pdf');
            } else if (target === 'excel') {
                resultBlob = new Blob([await file.arrayBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                outputName = file.name;
            } else if (target === 'text') {
                var sText = await extractSheetText(file);
                resultBlob = new Blob([sText], { type: 'text/plain;charset=utf-8' });
                outputName = changeExt(file.name, 'txt');
            } else {
                throw new Error('XLS can only be converted to PDF, Excel, or Text.');
            }

        // ---- SOURCE: PPTX ----
        } else if (sourceType === 'ppt') {
            if (target === 'pdf') {
                var pptText = await extractPptxText(file);
                resultBlob = await textToPdfBlob(pptText, baseName(file.name));
                outputName = changeExt(file.name, 'pdf');
            } else if (target === 'ppt') {
                resultBlob = new Blob([await file.arrayBuffer()], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
                outputName = file.name;
            } else if (target === 'text') {
                var pText = await extractPptxText(file);
                resultBlob = new Blob([pText], { type: 'text/plain;charset=utf-8' });
                outputName = changeExt(file.name, 'txt');
            } else {
                throw new Error('PPTX can only be converted to PDF or Text.');
            }

        // ---- SOURCE: IMAGE (PNG/JPG) ----
        } else if (sourceType === 'img') {
            if (target === 'pdf') {
                var imgData = await file.arrayBuffer();
                var imgPdf = await PDFLib.PDFDocument.create();
                var img = (ext === 'png') ? await imgPdf.embedPng(imgData) : await imgPdf.embedJpg(imgData);
                var iPage = imgPdf.addPage([img.width, img.height]);
                iPage.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                var iBytes = await imgPdf.save();
                resultBlob = new Blob([iBytes], { type: 'application/pdf' });
                outputName = changeExt(file.name, 'pdf');
            } else if (target === 'image') {
                resultBlob = new Blob([await file.arrayBuffer()], { type: file.type || 'image/png' });
                outputName = file.name;
            } else {
                throw new Error('Images can only be converted to PDF.');
            }

        // ---- SOURCE: TXT ----
        } else if (sourceType === 'txt') {
            if (target === 'pdf') {
                var txtContent = await file.text();
                resultBlob = await textToPdfBlob(txtContent, baseName(file.name));
                outputName = changeExt(file.name, 'pdf');
            } else if (target === 'text') {
                resultBlob = new Blob([await file.text()], { type: 'text/plain;charset=utf-8' });
                outputName = file.name;
            } else {
                throw new Error('TXT can only be converted to PDF.');
            }

        // ---- UNKNOWN SOURCE ----
        } else {
            throw new Error('Unsupported file format: .' + ext);
        }

        hideProcessing();
        showSuccess('Conversion complete: ' + outputName, resultBlob, outputName);
    } catch (error) {
        hideProcessing();
        alert('Error: ' + error.message);
        console.error(error);
    }
}

function getSourceTypeLabel(key) {
    return (key && SOURCE_TYPES[key]) ? SOURCE_TYPES[key].label : 'Unknown';
}

// ---------- Reverse extractors (Office -> text) ----------
async function extractDocxText(file) {
    if (typeof mammoth === 'undefined') throw new Error('Library mammoth not loaded.');
    var arrayBuffer = await file.arrayBuffer();
    var result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value || '';
}

async function extractSheetText(file) {
    if (typeof XLSX === 'undefined') throw new Error('Library XLSX not loaded.');
    var arrayBuffer = await file.arrayBuffer();
    var wb = XLSX.read(arrayBuffer, { type: 'array' });
    var out = '';
    wb.SheetNames.forEach(function(name) {
        var sheet = wb.Sheets[name];
        out += '=== ' + name + ' ===\n';
        out += XLSX.utils.sheet_to_csv(sheet, { FS: '\t' }) + '\n\n';
    });
    return out;
}

async function extractPptxText(file) {
    if (typeof JSZip === 'undefined') throw new Error('Library JSZip not loaded.');
    var arrayBuffer = await file.arrayBuffer();
    var zip = await JSZip.loadAsync(arrayBuffer);
    var slideEntries = [];
    zip.forEach(function(path, entry) {
        var m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        if (m) slideEntries.push({ num: parseInt(m[1], 10), entry: entry });
    });
    slideEntries.sort(function(a, b) { return a.num - b.num; });
    var out = '';
    for (var i = 0; i < slideEntries.length; i++) {
        var xml = await slideEntries[i].entry.async('text');
        var matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
        var slideText = matches.map(function(t) {
            var s = t.replace(/<[^>]+>/g, '');
            s = s.replace(/&/gi, '&');
            s = s.replace(/</gi, '<');
            s = s.replace(/>/gi, '>');
            return s;
        }).filter(function(s) { return s.trim().length > 0; }).join('\n');
        out += '=== Slide ' + (i + 1) + ' ===\n' + slideText + '\n\n';
    }
    return out;
}

// ---------- Universal text -> PDF builder ----------
function sanitizeForStandardFont(text) {
    if (!text) return '';
    // Decode HTML entities first
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    text = tempDiv.textContent || tempDiv.innerText || '';
    
    // Replace common Unicode characters with ASCII equivalents
    var replacements = {
        '\u2022': '*',    // bullet
        '\u2013': '-',    // en-dash
        '\u2014': '--',   // em-dash
        '\u2018': "'",    // left single quote
        '\u2019': "'",    // right single quote
        '\u201C': '"',    // left double quote
        '\u201D': '"',    // right double quote
        '\u2026': '...',  // ellipsis
        '\u00A0': ' ',    // non-breaking space
        '\u00B7': '*',    // middle dot
        '\u25CF': '*',    // black circle
        '\u25CB': 'o',    // white circle
        '\u2192': '->',   // right arrow
        '\u2190': '<-',   // left arrow
        '\u2191': '^',    // up arrow
        '\u2193': 'v',    // down arrow
        '\u00D7': 'x',    // multiplication sign
        '\u00F7': '/',    // division sign
        '\u00B0': ' deg', // degree sign
        '\u00A9': '(C)',  // copyright
        '\u00AE': '(R)',  // registered
        '\u2122': '(TM)', // trademark
        '\u20AC': 'EUR',  // euro
        '\u00A3': 'GBP',  // pound
        '\u00A5': 'JPY',  // yen
        '\u2605': '*',    // black star
        '\u2606': '*',    // white star
        '\u2713': 'V',    // checkmark
        '\u2717': 'X',    // ballot x
        '\u2010': '-',    // hyphen
        '\u2011': '-',    // non-breaking hyphen
        '\u2012': '-',    // figure dash
        '\u2015': '--',   // horizontal bar
        '\u2212': '-',    // minus sign
        '\u2260': '!=',   // not equal
        '\u2264': '<=',   // less than or equal
        '\u2265': '>=',   // greater than or equal
        '\u221E': 'inf',  // infinity
        '\u03B1': 'a',    // alpha
        '\u03B2': 'b',    // beta
        '\u03B3': 'g',    // gamma
        '\u03B4': 'd',    // delta
        '\u03C0': 'pi',   // pi
        '\u03A3': 'E',    // sigma
        '\u03A9': 'O',    // omega
        '\u00E0': 'a',    // a grave
        '\u00E1': 'a',    // a acute
        '\u00E2': 'a',    // a circumflex
        '\u00E3': 'a',    // a tilde
        '\u00E4': 'a',    // a umlaut
        '\u00E5': 'a',    // a ring
        '\u00E8': 'e',    // e grave
        '\u00E9': 'e',    // e acute
        '\u00EA': 'e',    // e circumflex
        '\u00EB': 'e',    // e umlaut
        '\u00EC': 'i',    // i grave
        '\u00ED': 'i',    // i acute
        '\u00EE': 'i',    // i circumflex
        '\u00EF': 'i',    // i umlaut
        '\u00F2': 'o',    // o grave
        '\u00F3': 'o',    // o acute
        '\u00F4': 'o',    // o circumflex
        '\u00F5': 'o',    // o tilde
        '\u00F6': 'o',    // o umlaut
        '\u00F9': 'u',    // u grave
        '\u00FA': 'u',    // u acute
        '\u00FB': 'u',    // u circumflex
        '\u00FC': 'u',    // u umlaut
        '\u00F1': 'n',    // n tilde
        '\u00E7': 'c',    // c cedilla
        '\u00DF': 'ss',   // sharp s
        '\u00C0': 'A',    // A grave
        '\u00C1': 'A',    // A acute
        '\u00C2': 'A',    // A circumflex
        '\u00C3': 'A',    // A tilde
        '\u00C4': 'A',    // A umlaut
        '\u00C5': 'A',    // A ring
        '\u00C8': 'E',    // E grave
        '\u00C9': 'E',    // E acute
        '\u00CA': 'E',    // E circumflex
        '\u00CB': 'E',    // E umlaut
        '\u00CC': 'I',    // I grave
        '\u00CD': 'I',    // I acute
        '\u00CE': 'I',    // I circumflex
        '\u00CF': 'I',    // I umlaut
        '\u00D2': 'O',    // O grave
        '\u00D3': 'O',    // O acute
        '\u00D4': 'O',    // O circumflex
        '\u00D5': 'O',    // O tilde
        '\u00D6': 'O',    // O umlaut
        '\u00D9': 'U',    // U grave
        '\u00DA': 'U',    // U acute
        '\u00DB': 'U',    // U circumflex
        '\u00DC': 'U',    // U umlaut
        '\u00D1': 'N',    // N tilde
        '\u00C7': 'C'     // C cedilla
    };
    
    var result = '';
    for (var i = 0; i < text.length; i++) {
        var char = text[i];
        var code = text.charCodeAt(i);
        if (replacements[char]) {
            result += replacements[char];
        } else if (code >= 32 && code <= 126) {
            result += char;
        } else if (code === 10 || code === 13 || code === 9) {
            result += char;
        } else if (code >= 128 && code <= 255) {
            // Latin-1 supplement - try to map
            result += replacements[char] || '?';
        } else {
            result += '?';
        }
    }
    return result.replace(/\t/g, '    ');
}

async function textToPdfBlob(rawText, title, opts) {
    opts = opts || {};
    var pdfDoc = await PDFLib.PDFDocument.create();
    var fontName = opts.monospace ? PDFLib.StandardFonts.Courier : PDFLib.StandardFonts.Helvetica;
    var boldName = opts.monospace ? PDFLib.StandardFonts.CourierBold : PDFLib.StandardFonts.HelveticaBold;
    var font = await pdfDoc.embedFont(fontName);
    var bold = await pdfDoc.embedFont(boldName);
    var fontSize = 11, lineHeight = fontSize * 1.4, pageWidth = 595.28, pageHeight = 841.89, margin = 56;
    var contentWidth = pageWidth - margin * 2;
    var page = pdfDoc.addPage([pageWidth, pageHeight]);
    var y = pageHeight - margin;
    function newPage() { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
    function ensureSpace(h) { if (y - h < margin) newPage(); }
    function drawLine(text, useBold) {
        ensureSpace(lineHeight);
        try { page.drawText(text, { x: margin, y: y - fontSize, size: fontSize, font: useBold ? bold : font, color: PDFLib.rgb(0.1, 0.1, 0.1) }); } catch (e) {}
        y -= lineHeight;
    }
    if (title) {
        var tStr = sanitizeForStandardFont(title);
        try { page.drawText(tStr, { x: margin, y: y - 16, size: 16, font: bold, color: PDFLib.rgb(0.1, 0.1, 0.1) }); } catch (e) {}
        y -= 28;
    }
    var text = sanitizeForStandardFont(rawText || '');
    var paragraphs = text.split('\n');
    for (var p = 0; p < paragraphs.length; p++) {
        var para = paragraphs[p];
        if (para === '') { y -= lineHeight * 0.5; if (y < margin) newPage(); continue; }
        var isHeader = /^={3,}.*={3,}$/.test(para.trim());
        if (isHeader) { y -= lineHeight * 0.5; ensureSpace(lineHeight); drawLine(para.trim().replace(/^=+\s*|\s*=+$/g, ''), true); continue; }
        var words = para.split(' '), line = '';
        for (var w = 0; w < words.length; w++) {
            var word = words[w], test = line ? line + ' ' + word : word;
            var width; try { width = font.widthOfTextAtSize(test, fontSize); } catch (e) { width = test.length * fontSize * 0.5; }
            if (width > contentWidth && line) { drawLine(line, false); line = word; } else { line = test; }
        }
        if (line) drawLine(line, false);
    }
    var pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
}

// ---------- Output builders ----------
async function buildDocxFromPages(pages) {
    if (typeof docx === 'undefined') throw new Error('Library docx not loaded.');
    var Document = docx.Document, Paragraph = docx.Paragraph, TextRun = docx.TextRun;
    var ImageRun = docx.ImageRun, HeadingLevel = docx.HeadingLevel, PageBreak = docx.PageBreak;
    var AlignmentType = docx.AlignmentType, Packer = docx.Packer;
    var MAX_IMG_WIDTH = 600, children = [];
    for (var idx = 0; idx < pages.length; idx++) {
        var p = pages[idx];
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Page ' + (idx + 1), bold: true })] }));
        var hasText = p && typeof p.text === 'string' && p.text.trim().length > 0;
        var hasImage = p && p.imageBuffer && p.imageWidth > 0 && p.imageHeight > 0;
        if (hasText) {
            var paragraphs = p.text.split(/\n\n+/);
            paragraphs.forEach(function(para) {
                var lines = para.split('\n').filter(function(l) { return l.trim().length > 0; });
                if (lines.length === 0) return;
                var runs = [];
                lines.forEach(function(line, i) {
                    runs.push(new TextRun(line));
                    if (i < lines.length - 1) runs.push(new TextRun({ text: '', break: 1 }));
                });
                children.push(new Paragraph({ children: runs }));
            });
        } else if (hasImage) {
            var ratio = MAX_IMG_WIDTH / p.imageWidth;
            var w = Math.round(p.imageWidth * ratio), h = Math.round(p.imageHeight * ratio);
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: p.imageBuffer, transformation: { width: w, height: h } })] }));
        } else {
            children.push(new Paragraph({ children: [new TextRun({ text: '(empty page)', italics: true })] }));
        }
        if (idx < pages.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    var doc = new Document({ sections: [{ properties: {}, children: children }] });
    return await Packer.toBlob(doc);
}

// High-fidelity PDF-to-Word: embeds each page as a full-page image
async function buildDocxFromPagesImage(pages) {
    if (typeof docx === 'undefined') throw new Error('Library docx not loaded.');
    var Document = docx.Document, Paragraph = docx.Paragraph, TextRun = docx.TextRun;
    var ImageRun = docx.ImageRun, AlignmentType = docx.AlignmentType, Packer = docx.Packer;
    // A4 in twips (1 inch = 1440 twips): 8.27" x 11.69"
    var A4_W_TWIP = 11906, A4_H_TWIP = 16838;
    // A4 usable at 96 DPI with zero margin = 794 x 1123 px
    var A4_W_PX = 794, A4_H_PX = 1123;
    var sections = [];
    for (var i = 0; i < pages.length; i++) {
        var p = pages[i];
        var sectionChildren = [];
        if (p && p.imageBuffer && p.imageWidth > 0 && p.imageHeight > 0) {
            var scale = Math.min(A4_W_PX / p.imageWidth, A4_H_PX / p.imageHeight);
            var w = Math.round(p.imageWidth * scale);
            var h = Math.round(p.imageHeight * scale);
            sectionChildren.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new ImageRun({ data: p.imageBuffer, transformation: { width: w, height: h } })]
            }));
        } else {
            // fallback plain text
            var lines = (p && p.text ? p.text : '').split('\n');
            lines.forEach(function(line) {
                sectionChildren.push(new Paragraph({ children: [new TextRun(line || ' ')] }));
            });
        }
        sections.push({
            properties: {
                page: {
                    size: { width: A4_W_TWIP, height: A4_H_TWIP },
                    margin: { top: 0, right: 0, bottom: 0, left: 0 }
                }
            },
            children: sectionChildren
        });
    }
    if (sections.length === 0) {
        sections = [{ properties: {}, children: [new Paragraph({ children: [new TextRun('(empty)')] })] }];
    }
    var doc = new Document({ sections: sections });
    return await Packer.toBlob(doc);
}

// ---- PDF structured extraction (for editable PDF→Word) ----

function getPdfFontStyle(page, fontKey) {
    try {
        var co = page.commonObjs, obj = null;
        if (co && co._objs && co._objs[fontKey]) {
            var raw = co._objs[fontKey];
            obj = (raw && raw.data) ? raw.data : raw;
        } else if (co && typeof co.get === 'function') {
            try { obj = co.get(fontKey); } catch(e2) {}
        }
        if (obj) {
            var name = obj.name || obj.loadedName || (obj.data && (obj.data.name || obj.data.loadedName)) || '';
            return { isBold: /bold/i.test(name), isItalic: /italic|oblique/i.test(name) };
        }
    } catch(e) {}
    return { isBold: /bold/i.test(fontKey), isItalic: /italic|oblique/i.test(fontKey) };
}

async function extractPdfStructured(file) {
    ensurePdfJs();
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var allPages = [];
    for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        var page = await pdf.getPage(pageNum);
        var viewport = page.getViewport({ scale: 1.0 });
        var pageWidth = viewport.width;
        // Render tiny to load fonts into commonObjs
        var tc0 = document.createElement('canvas'); tc0.width = 8; tc0.height = 11;
        await page.render({ canvasContext: tc0.getContext('2d'), viewport: page.getViewport({ scale: 0.01 }) }).promise;
        var tc = await page.getTextContent({ includeMarkedContent: false });
        var fontCache = {};
        var rawItems = tc.items.map(function(it) {
            var a = it.transform[0], b = it.transform[1];
            var fontSize = Math.round(Math.sqrt(a * a + b * b) * 100) / 100;
            if (fontSize < 0.5) fontSize = Math.abs(it.transform[3]) || 11;
            var fn = it.fontName || '';
            if (!fontCache[fn]) fontCache[fn] = getPdfFontStyle(page, fn);
            var fs = fontCache[fn];
            return { str: it.str || '', x: it.transform[4], y: it.transform[5], fontSize: fontSize, isBold: fs.isBold, isItalic: fs.isItalic, width: it.width || 0 };
        });
        // Group into lines (y tolerance 3pt)
        var lineGroups = [];
        rawItems.forEach(function(item) {
            for (var i = 0; i < lineGroups.length; i++) {
                if (Math.abs(lineGroups[i].y - item.y) <= 3) { lineGroups[i].items.push(item); return; }
            }
            lineGroups.push({ y: item.y, items: [item] });
        });
        lineGroups.sort(function(a, b) { return b.y - a.y; });
        var processedLines = lineGroups.map(function(lg) {
            var items = lg.items.sort(function(a, b) { return a.x - b.x; });
            var nonSpace = items.filter(function(it) { return it.str.trim(); });
            if (nonSpace.length === 0) return null;
            var text = items.map(function(it) { return it.str; }).join('').replace(/\s+/g, ' ').trim();
            var maxFont = nonSpace.reduce(function(m, it) { return Math.max(m, it.fontSize); }, 0);
            var firstX = nonSpace[0].x;
            var lastIt = nonSpace[nonSpace.length - 1];
            var centerX = (firstX + lastIt.x + (lastIt.width || 0)) / 2;
            var isCentered = Math.abs(centerX - pageWidth / 2) < pageWidth * 0.2;
            // Two-column detection
            var leftPart = nonSpace.filter(function(it) { return it.x < pageWidth * 0.52; });
            var rightPart = nonSpace.filter(function(it) { return it.x >= pageWidth * 0.52; });
            var isTwoCol = false;
            if (leftPart.length > 0 && rightPart.length > 0) {
                var rEdgeL = Math.max.apply(null, leftPart.map(function(it) { return it.x + (it.width || 0); }));
                var lEdgeR = Math.min.apply(null, rightPart.map(function(it) { return it.x; }));
                isTwoCol = (lEdgeR - rEdgeL) > pageWidth * 0.07;
            }
            return {
                text: text, items: nonSpace, y: lg.y, fontSize: maxFont,
                isBold: nonSpace.some(function(it) { return it.isBold; }),
                isItalic: nonSpace.length > 0 && nonSpace.every(function(it) { return it.isItalic; }),
                isCentered: isCentered, isTwoCol: isTwoCol,
                leftPart: isTwoCol ? leftPart : [], rightPart: isTwoCol ? rightPart : [],
                x: firstX, pageWidth: pageWidth
            };
        }).filter(Boolean);
        allPages.push(processedLines);
    }
    return allPages;
}

function pdfItemsToRuns(items, defaultHp) {
    var groups = [];
    items.forEach(function(it) {
        if (!it.str) return;
        var last = groups[groups.length - 1];
        if (last && last.isBold === it.isBold && last.isItalic === it.isItalic) { last.text += it.str; }
        else { groups.push({ text: it.str, isBold: it.isBold, isItalic: it.isItalic }); }
    });
    if (groups.length === 0) return [new docx.TextRun({ text: ' ', size: defaultHp })];
    return groups.filter(function(g) { return g.text.trim(); }).map(function(g) {
        return new docx.TextRun({ text: g.text, bold: g.isBold, italics: g.isItalic, size: defaultHp });
    });
}

async function buildDocxFromStructured(allPages) {
    if (typeof docx === 'undefined') throw new Error('Library docx not loaded.');
    var allChildren = [];
    for (var pi = 0; pi < allPages.length; pi++) {
        var lines = allPages[pi];
        if (!lines || lines.length === 0) continue;
        if (pi > 0) allChildren.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
        // Detect body font size (most frequent)
        var sizeCounts = {};
        lines.forEach(function(l) { var s = Math.round(l.fontSize * 2) / 2; sizeCounts[s] = (sizeCounts[s] || 0) + 1; });
        var bodyPt = parseFloat(Object.keys(sizeCounts).sort(function(a, b) { return sizeCounts[b] - sizeCounts[a]; })[0]) || 11;
        var bodyHp = Math.round(bodyPt * 2);
        lines.forEach(function(line) {
            var text = line.text.trim();
            if (!text) return;
            var lineHp = Math.max(16, Math.round(line.fontSize * 2));
            // Bullet detection
            var bulletMatch = text.match(/^[\u2022\u25aa\u2219\u2013\u2014\-]\s+([\s\S]*)/);
            var isBullet = !!bulletMatch;
            var bulletContent = bulletMatch ? bulletMatch[1] : text;
            // Section header detection (centered, all-caps)
            var isAllCaps = /^[^a-z]+$/.test(text) && /[A-Z]/.test(text);
            var isSectionHdr = line.isCentered && isAllCaps;
            var para;
            if (line.isTwoCol && line.leftPart.length && line.rightPart.length) {
                var lText = line.leftPart.map(function(it) { return it.str; }).join('').trim();
                var rText = line.rightPart.map(function(it) { return it.str; }).join('').trim();
                var lBold = line.leftPart.some(function(it) { return it.isBold; });
                para = new docx.Paragraph({
                    tabStops: [{ type: 'right', position: 9072 }],
                    spacing: { before: 160, after: 20 },
                    children: [
                        new docx.TextRun({ text: lText, bold: lBold, size: bodyHp }),
                        new docx.TextRun({ text: '\t' + rText, size: bodyHp })
                    ]
                });
            } else if (isSectionHdr) {
                para = new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    border: { bottom: { style: 'single', size: 6, space: 4, color: '000000' } },
                    spacing: { before: 240, after: 120 },
                    children: [new docx.TextRun({ text: text, bold: true, size: bodyHp })]
                });
            } else if (line.isCentered && lineHp > bodyHp + 2) {
                para = new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { before: 0, after: 80 },
                    children: [new docx.TextRun({ text: text, bold: true, size: lineHp })]
                });
            } else if (isBullet) {
                var bulletItems = line.items.filter(function(it) {
                    return it.x > (line.items[0] ? line.items[0].x + 4 : 0) || /[a-zA-Z0-9]/.test(it.str.charAt(0));
                });
                var bRuns = bulletItems.length > 0 ? pdfItemsToRuns(bulletItems, bodyHp) : [new docx.TextRun({ text: bulletContent, size: bodyHp })];
                para = new docx.Paragraph({ bullet: { level: 0 }, spacing: { before: 20, after: 40 }, children: bRuns });
            } else {
                var align = line.isCentered ? docx.AlignmentType.CENTER : docx.AlignmentType.LEFT;
                para = new docx.Paragraph({
                    alignment: align,
                    spacing: { before: 0, after: 60 },
                    children: pdfItemsToRuns(line.items, lineHp)
                });
            }
            allChildren.push(para);
        });
    }
    if (allChildren.length === 0) allChildren.push(new docx.Paragraph({ children: [new docx.TextRun('(empty)')] }));
    var doc = new docx.Document({
        sections: [{
            properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1008, right: 1152, bottom: 1008, left: 1152 } } },
            children: allChildren
        }]
    });
    return await docx.Packer.toBlob(doc);
}


function buildXlsxFromPages(pages) {
    if (typeof XLSX === 'undefined') throw new Error('Library XLSX not loaded.');
    var wb = XLSX.utils.book_new();
    pages.forEach(function(pageText, idx) {
        var rows = pageText.split('\n').map(function(line) { return line.split(/\t|\s{2,}/); });
        var ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Page ' + (idx + 1));
    });
    if (pages.length === 0) {
        var wsEmpty = XLSX.utils.aoa_to_sheet([['No content']]);
        XLSX.utils.book_append_sheet(wb, wsEmpty, 'Sheet1');
    }
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer), binary = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(binary);
}

async function buildPptxFromPages(pages) {
    if (typeof PptxGenJS === 'undefined') throw new Error('Library PptxGenJS not loaded.');
    var pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE';
    for (var idx = 0; idx < pages.length; idx++) {
        var p = pages[idx], slide = pptx.addSlide();
        slide.addText('Page ' + (idx + 1), { x: 0.3, y: 0.2, w: 12.7, h: 0.5, fontSize: 18, bold: true, color: '363636' });
        var hasText = p && typeof p.text === 'string' && p.text.trim().length > 0;
        var hasImage = p && p.imageBuffer && p.imageWidth > 0 && p.imageHeight > 0;
        if (hasText) {
            slide.addText(p.text, { x: 0.5, y: 0.9, w: 12.3, h: 6.3, fontSize: 11, color: '363636', valign: 'top', isTextBox: true });
        } else if (hasImage) {
            var slideW = 12.7, slideH = 6.5, imgRatio = p.imageWidth / p.imageHeight, slotRatio = slideW / slideH;
            var w, h;
            if (imgRatio > slotRatio) { w = slideW; h = slideW / imgRatio; } else { h = slideH; w = slideH * imgRatio; }
            var x = (13.333 - w) / 2, y = 0.85 + (slideH - h) / 2;
            var base64 = arrayBufferToBase64(p.imageBuffer);
            slide.addImage({ data: 'data:image/png;base64,' + base64, x: x, y: y, w: w, h: h });
        } else {
            slide.addText('(empty page)', { x: 0.5, y: 3, w: 12.3, h: 1, fontSize: 14, italic: true, color: '888888', align: 'center' });
        }
    }
    var result = await pptx.write({ outputType: 'blob' });
    return result instanceof Blob ? result : new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

// ---------- Processing: Organize (Merge only) ----------
async function processOrganize(files) {
    showProcessing('Merging PDFs...', 'Combining your PDF files');
    try {
        if (files.length < 2) { hideProcessing(); alert('Please select at least 2 PDF files to merge.'); return; }
        var mergedPdf = await PDFLib.PDFDocument.create();
        for (var i = 0; i < files.length; i++) {
            var buf = await files[i].arrayBuffer();
            var doc = await PDFLib.PDFDocument.load(buf);
            var copied = await mergedPdf.copyPages(doc, doc.getPageIndices());
            copied.forEach(function(p) { mergedPdf.addPage(p); });
        }
        var resultBlob = new Blob([await mergedPdf.save()], { type: 'application/pdf' });
        hideProcessing();
        showSuccess('Merge completed', resultBlob, 'merged.pdf');
    } catch (error) { hideProcessing(); alert('Error: ' + error.message); }
}

// ---------- Edit Page ----------
var editPdfDoc = null;
var editPdfBytes = null;
var editCanvas = null;
var editCtx = null;
var editTool = 'text';
var editDrawing = false;

function setupEdit() {
    var uploadZone = document.getElementById('edit-upload');
    var fileInput = document.getElementById('edit-file-input');
    var uploadBtn = uploadZone.querySelector('.btn-upload');
    var uploadContent = uploadZone.querySelector('.upload-zone-content');
    var preview = document.getElementById('edit-preview');
    var fileList = document.getElementById('edit-file-list');
    var toolbar = document.getElementById('edit-toolbar');
    var saveBtn = document.getElementById('edit-save-btn');

    // Setup toolbar buttons
    document.querySelectorAll('.edit-tool-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tool = this.dataset.tool;
            if (tool === 'undo' || tool === 'redo') return;
            document.querySelectorAll('.edit-tool-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            editTool = tool;
            setupEditCanvas();
        });
    });

    uploadBtn.addEventListener('click', function(e) { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', function() {
        var files = Array.from(this.files);
        if (files.length > 0) {
            state.uploadedFiles = files;
            showFileList(files, fileList);
            uploadContent.style.display = 'none';
            preview.style.display = 'block';
            toolbar.style.display = 'flex';
            loadEditPdf(files[0]);
        }
    });
    uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', function(e) { e.preventDefault(); uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault(); uploadZone.classList.remove('dragover');
        var files = Array.from(e.dataTransfer.files).filter(function(f) { return /\.pdf$/i.test(f.name); });
        if (files.length > 0) {
            state.uploadedFiles = files;
            showFileList(files, fileList);
            uploadContent.style.display = 'none';
            preview.style.display = 'block';
            toolbar.style.display = 'flex';
            loadEditPdf(files[0]);
        }
    });
    if (saveBtn) {
        saveBtn.addEventListener('click', async function() {
            if (editPdfDoc) {
                showProcessing('Saving PDF...', 'Applying overlays');
                try {
                    await applyOverlaysToPdf();
                    var bytes = await editPdfDoc.save();
                    var blob = new Blob([bytes], { type: 'application/pdf' });
                    hideProcessing();
                    showSuccess('PDF edited successfully', blob, 'edited_' + (state.uploadedFiles[0] ? state.uploadedFiles[0].name : 'document.pdf'));
                    
                    editPdfBytes = bytes;
                    document.getElementById('edit-overlays-container').innerHTML = '';
                    renderEditPage(0);
                } catch(e) {
                    hideProcessing();
                    alert('Error saving PDF: ' + e.message);
                }
            }
        });
    }
}

function setupEditCanvas() {
    editCanvas = document.getElementById('pdf-edit-canvas');
    if (!editCanvas) return;
    editCtx = editCanvas.getContext('2d');
    
    // Remove existing listeners by cloning
    var newCanvas = editCanvas.cloneNode(true);
    var newCtx = newCanvas.getContext('2d');
    newCtx.drawImage(editCanvas, 0, 0);
    editCanvas.parentNode.replaceChild(newCanvas, editCanvas);
    editCanvas = newCanvas;
    editCtx = newCtx;
    
    var overlays = document.getElementById('edit-overlays-container');
    if (overlays) {
        if (editTool === 'text' || editTool === 'watermark') {
            overlays.style.pointerEvents = 'auto';
        } else {
            overlays.style.pointerEvents = 'none';
        }
    }
    
    if (editTool === 'draw') {
        editCanvas.style.cursor = 'crosshair';
        editCanvas.addEventListener('mousedown', startEditDraw);
        editCanvas.addEventListener('mousemove', editDraw);
        editCanvas.addEventListener('mouseup', stopEditDraw);
        editCanvas.addEventListener('mouseout', stopEditDraw);
        if (overlays) overlays.onclick = null;
    } else if (editTool === 'text') {
        editCanvas.style.cursor = 'text';
        if (overlays) {
            overlays.onclick = function(e) {
                if(e.target === overlays && editTool === 'text') addTextOverlayClick(e);
            };
        }
    } else if (editTool === 'watermark') {
        editCanvas.style.cursor = 'pointer';
        if (overlays) overlays.onclick = null;
        addWatermarkOverlay();
    } else if (editTool === 'shape') {
        editCanvas.style.cursor = 'crosshair';
        if (overlays) overlays.onclick = null;
    }
}

function createOverlayWrapper(type, text, left, top, angle, fontSize) {
    var wrapper = document.createElement('div');
    wrapper.className = 'overlay-wrapper';
    wrapper.style.left = left + 'px';
    wrapper.style.top = top + 'px';
    wrapper.dataset.angle = angle || 0;
    wrapper.style.transform = 'translate(-50%, -50%) rotate(' + (angle || 0) + 'deg)';
    
    var controls = document.createElement('div');
    controls.className = 'overlay-controls';
    
    var dragBtn = document.createElement('button');
    dragBtn.className = 'overlay-btn btn-drag';
    dragBtn.title = 'Drag';
    dragBtn.innerHTML = '<i class="ph ph-arrows-out-cardinal"></i>';
    
    var sizeDownBtn = document.createElement('button');
    sizeDownBtn.className = 'overlay-btn btn-size';
    sizeDownBtn.title = 'Decrease Size';
    sizeDownBtn.innerHTML = '<i class="ph ph-minus"></i>';
    
    var sizeUpBtn = document.createElement('button');
    sizeUpBtn.className = 'overlay-btn btn-size';
    sizeUpBtn.title = 'Increase Size';
    sizeUpBtn.innerHTML = '<i class="ph ph-plus"></i>';
    
    var rotBtn = document.createElement('button');
    rotBtn.className = 'overlay-btn btn-rotate';
    rotBtn.title = 'Rotate';
    rotBtn.innerHTML = '<i class="ph ph-arrow-clockwise"></i>';
    
    var delBtn = document.createElement('button');
    delBtn.className = 'overlay-btn btn-delete';
    delBtn.title = 'Delete';
    delBtn.innerHTML = '<i class="ph ph-x"></i>';
    
    controls.appendChild(dragBtn);
    controls.appendChild(sizeDownBtn);
    controls.appendChild(sizeUpBtn);
    controls.appendChild(rotBtn);
    controls.appendChild(delBtn);
    
    var content = document.createElement('div');
    content.className = 'overlay-content';
    content.dataset.type = type;
    content.contentEditable = true;
    content.style.fontSize = fontSize + 'px';
    content.textContent = text;
    
    var cornerTL = document.createElement('div'); cornerTL.className = 'corner-handle tl';
    var cornerTR = document.createElement('div'); cornerTR.className = 'corner-handle tr';
    var cornerBL = document.createElement('div'); cornerBL.className = 'corner-handle bl';
    var cornerBR = document.createElement('div'); cornerBR.className = 'corner-handle br';
    
    var rotEdge = document.createElement('div');
    rotEdge.className = 'rotate-handle-edge';
    rotEdge.title = 'Rotate';
    
    wrapper.appendChild(controls);
    wrapper.appendChild(content);
    wrapper.appendChild(cornerTL);
    wrapper.appendChild(cornerTR);
    wrapper.appendChild(cornerBL);
    wrapper.appendChild(cornerBR);
    wrapper.appendChild(rotEdge);
    
    setupOverlayInteractions(wrapper, dragBtn, sizeDownBtn, sizeUpBtn, rotBtn, delBtn, content, [cornerTL, cornerTR, cornerBL, cornerBR], rotEdge);
    
    return { wrapper: wrapper, content: content };
}

function setupOverlayInteractions(wrapper, dragBtn, sizeDownBtn, sizeUpBtn, rotBtn, delBtn, content, resizeHandles, rotEdge) {
    delBtn.onclick = function(e) {
        e.stopPropagation();
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };
    
    sizeDownBtn.onclick = function(e) {
        e.stopPropagation();
        var currentSize = parseFloat(content.style.fontSize) || 24;
        content.style.fontSize = Math.max(8, currentSize - 4) + 'px';
    };
    
    sizeUpBtn.onclick = function(e) {
        e.stopPropagation();
        var currentSize = parseFloat(content.style.fontSize) || 24;
        content.style.fontSize = (currentSize + 4) + 'px';
    };
    
    content.addEventListener('focus', function() {
        document.querySelectorAll('.overlay-wrapper').forEach(function(w) { w.classList.remove('active'); });
        wrapper.classList.add('active');
    });
    
    var isDragging = false;
    var startX, startY, startLeft, startTop;
    var container = document.getElementById('pdf-page-container');
    
    dragBtn.onmousedown = function(e) {
        e.preventDefault(); e.stopPropagation();
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        startLeft = parseFloat(wrapper.style.left) || 0;
        startTop = parseFloat(wrapper.style.top) || 0;
        
        var rect = container.getBoundingClientRect();
        var scaleX = container.offsetWidth / rect.width;
        var scaleY = container.offsetHeight / rect.height;
        
        function onMouseMove(me) {
            if (!isDragging) return;
            var dx = (me.clientX - startX) * scaleX;
            var dy = (me.clientY - startY) * scaleY;
            wrapper.style.left = (startLeft + dx) + 'px';
            wrapper.style.top = (startTop + dy) + 'px';
        }
        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    
    var isRotating = false;
    var startAngle;
    
    function startRotation(e) {
        e.preventDefault(); e.stopPropagation();
        isRotating = true;
        
        var rect = wrapper.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        startAngle = parseFloat(wrapper.dataset.angle) || 0;
        
        var startMouseAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
        
        function onMouseMove(me) {
            if (!isRotating) return;
            var currentMouseAngle = Math.atan2(me.clientY - cy, me.clientX - cx) * 180 / Math.PI;
            var newAngle = startAngle + (currentMouseAngle - startMouseAngle);
            wrapper.dataset.angle = newAngle;
            wrapper.style.transform = 'translate(-50%, -50%) rotate(' + newAngle + 'deg)';
        }
        function onMouseUp() {
            isRotating = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
    
    rotBtn.onmousedown = startRotation;
    rotEdge.onmousedown = startRotation;
    
    var isResizing = false;
    resizeHandles.forEach(function(handle) {
        handle.onmousedown = function(e) {
            e.preventDefault(); e.stopPropagation();
            isResizing = true;
            
            var rect = wrapper.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var startDist = Math.hypot(e.clientX - cx, e.clientY - cy);
            var startFontSize = parseFloat(content.style.fontSize) || 24;
            
            function onMouseMove(me) {
                if (!isResizing) return;
                var currentDist = Math.hypot(me.clientX - cx, me.clientY - cy);
                if (startDist === 0) return;
                var scale = currentDist / startDist;
                var newSize = Math.max(8, startFontSize * scale);
                content.style.fontSize = newSize + 'px';
            }
            function onMouseUp() {
                isResizing = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    });
}

function addTextOverlayClick(e) {
    var container = document.getElementById('pdf-page-container');
    var rect = container.getBoundingClientRect();
    var scaleX = container.offsetWidth / rect.width;
    var scaleY = container.offsetHeight / rect.height;
    
    var x = (e.clientX - rect.left) * scaleX;
    var y = (e.clientY - rect.top) * scaleY;
    
    var overlays = document.getElementById('edit-overlays-container');
    var res = createOverlayWrapper('text', 'Type here', x, y, 0, 24);
    res.wrapper.style.maxWidth = container.offsetWidth + 'px';
    overlays.appendChild(res.wrapper);
    res.content.focus();
    
    var range = document.createRange();
    range.selectNodeContents(res.content);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function addWatermarkOverlay() {
    var overlays = document.getElementById('edit-overlays-container');
    if (!overlays) return;
    
    var existing = overlays.querySelector('.overlay-content[data-type="watermark"]');
    if (existing) {
        existing.focus();
        return;
    }
    
    var container = document.getElementById('pdf-page-container');
    var x = container.offsetWidth / 2;
    var y = container.offsetHeight / 2;
    
    var res = createOverlayWrapper('watermark', 'CONFIDENTIAL', x, y, -45, 80);
    res.wrapper.style.maxWidth = container.offsetWidth + 'px';
    overlays.appendChild(res.wrapper);
    res.content.focus();
    
    var range = document.createRange();
    range.selectNodeContents(res.content);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

async function applyOverlaysToPdf() {
    var overlays = document.getElementById('edit-overlays-container').children;
    if (overlays.length === 0) return;
    
    var pages = editPdfDoc.getPages();
    var page = pages[0];
    var helveticaFont = await editPdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    
    var container = document.getElementById('pdf-page-container');
    var pdfSize = page.getSize();
    var scaleX = pdfSize.width / container.offsetWidth;
    var scaleY = pdfSize.height / container.offsetHeight;
    
    for (var i = 0; i < overlays.length; i++) {
        var wrapper = overlays[i];
        var content = wrapper.querySelector('.overlay-content');
        if (!content) continue;
        
        var text = content.innerText || content.textContent;
        if (!text.trim()) continue;
        
        var isWatermark = content.dataset.type === 'watermark';
        
        var style = window.getComputedStyle(content);
        var fontSizeCss = parseFloat(style.fontSize);
        var pdfFontSize = fontSizeCss * scaleY;
        
        var leftCss = parseFloat(wrapper.style.left);
        var topCss = parseFloat(wrapper.style.top);
        var angle = parseFloat(wrapper.dataset.angle) || 0;
        
        var cxPdf = leftCss * scaleX;
        var cyPdf = pdfSize.height - (topCss * scaleY);
        
        // Emulate CSS max-width wrapping
        var pdfMaxWidth = pdfSize.width; // Because wrapper maxWidth is container.offsetWidth
        var rawLines = text.split('\n');
        var wrappedLines = [];
        for (var r = 0; r < rawLines.length; r++) {
            var words = rawLines[r].split(' ');
            var currentLine = words[0] || '';
            for (var w = 1; w < words.length; w++) {
                var word = words[w];
                var testLine = currentLine + " " + word;
                if (helveticaFont.widthOfTextAtSize(testLine, pdfFontSize) <= pdfMaxWidth) {
                    currentLine = testLine;
                } else {
                    wrappedLines.push(currentLine);
                    currentLine = word;
                }
            }
            wrappedLines.push(currentLine);
        }
        text = wrappedLines.join('\n');
        
        var lines = text.split('\n');
        var textW = 0;
        for (var l = 0; l < lines.length; l++) {
            textW = Math.max(textW, helveticaFont.widthOfTextAtSize(lines[l], pdfFontSize));
        }
        var textH = pdfFontSize + (lines.length - 1) * (pdfFontSize * 1.2);
        
        var theta = -angle * Math.PI / 180;
        var cosT = Math.cos(theta);
        var sinT = Math.sin(theta);
        
        var dx = -textW / 2;
        var dy = textH / 2 - pdfFontSize;
        
        var sxPdf = cxPdf + dx * cosT - dy * sinT;
        var syPdf = cyPdf + dx * sinT + dy * cosT;
        
        if (isWatermark) {
            for (var p = 0; p < pages.length; p++) {
                var pg = pages[p];
                var pSize = pg.getSize();
                var p_cxPdf = leftCss * (pSize.width / container.offsetWidth);
                var p_cyPdf = pSize.height - (topCss * (pSize.height / container.offsetHeight));
                var p_sxPdf = p_cxPdf + dx * cosT - dy * sinT;
                var p_syPdf = p_cyPdf + dx * sinT + dy * cosT;
                
                pg.drawText(text, {
                    x: p_sxPdf,
                    y: p_syPdf,
                    size: pdfFontSize,
                    font: helveticaFont,
                    color: PDFLib.rgb(0.5, 0.5, 0.5),
                    opacity: 0.3,
                    rotate: PDFLib.degrees(-angle),
                    lineHeight: pdfFontSize * 1.2
                });
            }
        } else {
            page.drawText(text, {
                x: sxPdf,
                y: syPdf,
                size: pdfFontSize,
                font: helveticaFont,
                color: PDFLib.rgb(0, 0, 0),
                rotate: PDFLib.degrees(-angle),
                lineHeight: pdfFontSize * 1.2
            });
        }
    }
}

function startEditDraw(e) {
    editDrawing = true;
    var container = document.getElementById('pdf-page-container');
    var rect = container.getBoundingClientRect();
    var scaleX = container.offsetWidth / rect.width;
    var scaleY = container.offsetHeight / rect.height;
    editCtx.beginPath();
    editCtx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
}

function editDraw(e) {
    if (!editDrawing) return;
    var container = document.getElementById('pdf-page-container');
    var rect = container.getBoundingClientRect();
    var scaleX = container.offsetWidth / rect.width;
    var scaleY = container.offsetHeight / rect.height;
    editCtx.strokeStyle = '#ef4444';
    editCtx.lineWidth = 3 * scaleX;
    editCtx.lineCap = 'round';
    editCtx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    editCtx.stroke();
}

function stopEditDraw() {
    editDrawing = false;
}

async function loadEditPdf(file) {
    try {
        // Clone the ArrayBuffer to prevent detached buffer issues
        var buffer = await file.arrayBuffer();
        editPdfBytes = buffer.slice(0);
        editPdfDoc = await PDFLib.PDFDocument.load(editPdfBytes);
        renderEditPage(0);
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF: ' + error.message);
    }
}

async function renderEditPage(pageIndex) {
    if (!editPdfDoc) return;
    try {
        ensurePdfJs();
        // Clone buffer again for pdfjs to avoid detached buffer error
        var bufferForRender = editPdfBytes.slice(0);
        var loadingTask = pdfjsLib.getDocument({ data: bufferForRender });
        var pdf = await loadingTask.promise;
        var page = await pdf.getPage(pageIndex + 1);
        var viewport = page.getViewport({ scale: 1.5 });
        var canvas = document.getElementById('pdf-edit-canvas');
        var wrapper = document.getElementById('edit-canvas-wrapper');
        var container = document.getElementById('pdf-page-container');
        if (!canvas || !wrapper || !container) return;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        container.style.width = viewport.width + 'px';
        container.style.height = viewport.height + 'px';
        
        wrapper.style.display = 'flex';
        
        var availableW = wrapper.clientWidth - 40;
        var availableH = wrapper.clientHeight - 40;
        var scale = Math.min(availableW / viewport.width, availableH / viewport.height);
        container.style.transform = 'scale(' + scale + ')';
        
        var ctx = canvas.getContext('2d');
        // Set white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        // Setup canvas after render
        setupEditCanvas();
    } catch (error) {
        console.error('Error rendering page:', error);
        alert('Error rendering PDF page: ' + error.message);
    }
}

// ---------- Sign Page ----------
var signPdfDoc = null;
var signPdfBytes = null;
var signatureDataUrl = null;
var signCanvas = null;
var signCtx = null;
var isDrawing = false;

function setupSign() {
    var uploadZone = document.getElementById('sign-upload');
    var fileInput = document.getElementById('sign-file-input');
    var uploadBtn = uploadZone.querySelector('.btn-upload');
    var uploadContent = uploadZone.querySelector('.upload-zone-content');
    var preview = document.getElementById('sign-preview');
    var fileList = document.getElementById('sign-file-list');
    var saveBtn = document.getElementById('sign-save-btn');

    uploadBtn.addEventListener('click', function(e) { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', function() {
        var files = Array.from(this.files);
        if (files.length > 0) {
            state.uploadedFiles = files;
            showFileList(files, fileList);
            uploadContent.style.display = 'none';
            preview.style.display = 'block';
            loadSignPdf(files[0]);
            initSignCanvas();
        }
    });
    uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', function(e) { e.preventDefault(); uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault(); uploadZone.classList.remove('dragover');
        var files = Array.from(e.dataTransfer.files).filter(function(f) { return /\.pdf$/i.test(f.name); });
        if (files.length > 0) {
            state.uploadedFiles = files;
            showFileList(files, fileList);
            uploadContent.style.display = 'none';
            preview.style.display = 'block';
            loadSignPdf(files[0]);
            initSignCanvas();
        }
    });
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            if (signPdfDoc && signatureDataUrl) {
                applySignatureToPdf();
            } else if (!signatureDataUrl) {
                alert('Please draw your signature first');
            }
        });
    }
}

// ---------- AI Chat & AI Summarize File Preview ----------
function setupAiFilePreview(pagePrefix, uploadZoneId, fileInputId) {
    var uploadZone = document.getElementById(uploadZoneId);
    var fileInput = document.getElementById(fileInputId);
    var uploadContent = uploadZone.querySelector('.upload-zone-content');
    var filePreview = document.getElementById(pagePrefix + '-file-preview');
    var thumbContainer = document.getElementById(pagePrefix + '-thumb');
    var fileNameEl = document.getElementById(pagePrefix + '-file-name');
    var fileSizeEl = document.getElementById(pagePrefix + '-file-size');
    var filePagesEl = document.getElementById(pagePrefix + '-file-pages');
    var changeBtn = document.getElementById(pagePrefix + '-change-file');
    var removeBtn = document.getElementById(pagePrefix + '-remove-file');
    var errorEl = document.getElementById(pagePrefix + '-upload-error');
    
    var currentFile = null;
    
    function showFilePreview(file) {
        currentFile = file;
        uploadContent.style.display = 'none';
        filePreview.style.display = '';
        errorEl.style.display = 'none';
        
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = formatFileSize(file.size);
        filePagesEl.textContent = '';
        thumbContainer.innerHTML = '<div class="thumb-placeholder"><i class="ph ph-file-pdf"></i></div>';
        
        // Render PDF thumbnail and get page count
        file.arrayBuffer().then(function(data) {
            return pdfjsLib.getDocument({ data: data }).promise;
        }).then(function(pdf) {
            filePagesEl.textContent = pdf.numPages + ' pages';
            return pdf.getPage(1);
        }).then(function(page) {
            var viewport = page.getViewport({ scale: 0.3 });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');
            return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
                thumbContainer.innerHTML = '';
                thumbContainer.appendChild(canvas);
            });
        }).catch(function(err) {
            console.warn('Preview error:', err);
        });
    }
    
    function resetUpload() {
        currentFile = null;
        fileInput.value = '';
        uploadContent.style.display = '';
        filePreview.style.display = 'none';
        errorEl.style.display = 'none';
    }
    
    function showError(message) {
        errorEl.querySelector('span').textContent = message;
        errorEl.style.display = 'flex';
    }
    
    // Upload button
    uploadZone.querySelector('.btn-upload').addEventListener('click', function(e) {
        e.stopPropagation();
        fileInput.click();
    });
    
    // Change file button
    if (changeBtn) {
        changeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            fileInput.click();
        });
    }
    
    // Remove file button
    if (removeBtn) {
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            resetUpload();
        });
    }
    
    // File input change
    fileInput.addEventListener('change', function() {
        var files = Array.from(this.files);
        if (files.length > 0) {
            var file = files[0];
            if (!/\.pdf$/i.test(file.name)) {
                showError('PDF files only. Please select a valid PDF file.');
                return;
            }
            showFilePreview(file);
        }
    });
    
    // Drag and drop
    uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        var files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            var file = files[0];
            if (!/\.pdf$/i.test(file.name)) {
                showError('PDF files only. Please drop a valid PDF file.');
                return;
            }
            showFilePreview(file);
        }
    });
    
    // Click on upload zone to trigger file dialog (only when no file selected)
    uploadZone.addEventListener('click', function(e) {
        if (filePreview.style.display === 'none') {
            fileInput.click();
        }
    });
}

function setupAiChat() {
    setupAiFilePreview('ai', 'ai-upload', 'ai-file-input');
}

function setupAiSummarize() {
    setupAiFilePreview('summarize', 'summarize-upload', 'summarize-file-input');
}

function initSignCanvas() {
    signCanvas = document.getElementById('sign-canvas');
    if (!signCanvas) return;
    signCanvas.width = signCanvas.offsetWidth;
    signCanvas.height = 150;
    signCtx = signCanvas.getContext('2d');
    signCtx.fillStyle = 'white';
    signCtx.fillRect(0, 0, signCanvas.width, signCanvas.height);
    signCtx.strokeStyle = '#000';
    signCtx.lineWidth = 2;
    signCtx.lineCap = 'round';

    signCanvas.addEventListener('mousedown', startDrawing);
    signCanvas.addEventListener('mousemove', draw);
    signCanvas.addEventListener('mouseup', stopDrawing);
    signCanvas.addEventListener('mouseout', stopDrawing);
    signCanvas.addEventListener('touchstart', function(e) { e.preventDefault(); startDrawing(e.touches[0]); });
    signCanvas.addEventListener('touchmove', function(e) { e.preventDefault(); draw(e.touches[0]); });
    signCanvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    var rect = signCanvas.getBoundingClientRect();
    signCtx.beginPath();
    signCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
    if (!isDrawing) return;
    var rect = signCanvas.getBoundingClientRect();
    signCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    signCtx.stroke();
}

function stopDrawing() {
    isDrawing = false;
    if (signCanvas) {
        signatureDataUrl = signCanvas.toDataURL('image/png');
    }
}

window.clearSignature = function() {
    if (signCtx && signCanvas) {
        signCtx.fillStyle = 'white';
        signCtx.fillRect(0, 0, signCanvas.width, signCanvas.height);
        signatureDataUrl = null;
    }
};

window.placeSignature = function() {
    if (signatureDataUrl) {
        document.getElementById('sign-pad').style.display = 'none';
        showSuccess('Signature ready', null, null);
        setTimeout(function() { closeModals(); }, 500);
    }
};

async function loadSignPdf(file) {
    try {
        signPdfBytes = await file.arrayBuffer();
        signPdfDoc = await PDFLib.PDFDocument.load(signPdfBytes);
    } catch (error) {
        alert('Error loading PDF: ' + error.message);
    }
}

async function applySignatureToPdf() {
    if (!signPdfDoc || !signatureDataUrl) return;
    showProcessing('Adding signature...', 'Please wait');
    try {
        var pngBytes = await fetch(signatureDataUrl).then(function(r) { return r.arrayBuffer(); });
        var pngImage = await signPdfDoc.embedPng(pngBytes);
        var pages = signPdfDoc.getPages();
        var firstPage = pages[0];
        var dims = firstPage.getSize();
        firstPage.drawImage(pngImage, {
            x: dims.width / 2 - 100,
            y: 50,
            width: 200,
            height: 60
        });
        var pdfBytes = await signPdfDoc.save();
        var blob = new Blob([pdfBytes], { type: 'application/pdf' });
        hideProcessing();
        showSuccess('PDF signed successfully', blob, 'signed_' + (state.uploadedFiles[0] ? state.uploadedFiles[0].name : 'document.pdf'));
    } catch (error) {
        hideProcessing();
        alert('Error adding signature: ' + error.message);
    }
}

// ---------- Modals ----------
var _processingInterval = null;

function forceShow(modal) {
    if (!modal) return;
    modal.classList.add('active');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('z-index', '99999', 'important');
}

function forceHide(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.setProperty('display', 'none', 'important');
}

function showProcessing(title, text) {
    var modal = document.getElementById('processing-modal');
    var pTitle = document.getElementById('processing-title');
    var pText = document.getElementById('processing-text');
    var pFill = document.getElementById('progress-fill');
    if (!modal) { alert(title + ' — ' + text); return; }
    if (pTitle) pTitle.textContent = title;
    if (pText) pText.textContent = text;
    if (pFill) pFill.style.width = '0%';
    forceShow(modal);
    if (_processingInterval) clearInterval(_processingInterval);
    var progress = 0;
    _processingInterval = setInterval(function() {
        progress += Math.random() * 12;
        if (progress >= 90) { progress = 90; clearInterval(_processingInterval); _processingInterval = null; }
        if (pFill) pFill.style.width = progress + '%';
    }, 200);
}

function hideProcessing() {
    if (_processingInterval) { clearInterval(_processingInterval); _processingInterval = null; }
    var pFill = document.getElementById('progress-fill');
    if (pFill) pFill.style.width = '100%';
    setTimeout(function() { forceHide(document.getElementById('processing-modal')); }, 250);
}

function showSuccess(message, blob, filename) {
    state.processedBlob = blob;
    state.processedFilename = filename;
    var t = document.getElementById('success-text');
    if (t) t.textContent = message;
    forceShow(document.getElementById('success-modal'));
}

window.closeModals = function() {
    forceHide(document.getElementById('processing-modal'));
    forceHide(document.getElementById('success-modal'));
};

// ==========================================
// SMART TOOLS ROUTING AND GENERIC LOGIC
// ==========================================

window.scrollToCat = function(catId) {
    var navItem = document.querySelector('.nav-item[data-category="' + catId + '"]');
    if (navItem) {
        filterCategory(catId, navItem);
    }
};

// Handle radio changes — update dependent controls and clear output
window._gtRadioChange = function(controlId, value) {
    // Clear output whenever any control changes
    var out = document.getElementById('gt-output');
    if (out) out.innerHTML = '';

    if (controlId === 'resize-mode') {
        var labelEl = document.querySelector('label[for="gt-resize-value"], .gt-control-item .gt-label');
        // Find the value input and its parent label
        var valInput = document.getElementById('gt-resize-value');
        if (!valInput) return;
        var lbl = document.getElementById('lbl-gt-resize-value');
        if (value === 'width') {
            if (lbl) lbl.textContent = 'Width (px)';
            valInput.placeholder = '800';
            valInput.value = '800';
            valInput.min = '1';
            valInput.max = '10000';
        } else {
            if (lbl) lbl.textContent = 'Percentage (1–100)';
            valInput.placeholder = '50';
            valInput.value = '50';
            valInput.min = '1';
            valInput.max = '100';
        }
    }
};

window.openGenericTool = function(toolId) {
    // hide all pages
    document.querySelectorAll('.page-content').forEach(function(el) { el.classList.remove('active'); });
    var gtPage = document.getElementById('page-generic-tool');
    gtPage.classList.add('active');
    
    var title = document.getElementById('gt-title');
    var desc = document.getElementById('gt-desc');
    var container = document.getElementById('gt-container');
    container.innerHTML = '';
    
    // Tool configurations with proper UI definitions
    var toolConfigs = {
        'files-to-pdf': {
            t: 'Files to PDF', d: 'Convert images, documents, and text files to PDF',
            type: 'file', accept: '.png,.jpg,.jpeg,.txt,.md,.docx,.xlsx,.xls,.csv,.pptx',
            controls: []
        },
        'pdf-to-word': {
            t: 'PDF to Word', d: 'Convert PDF to editable Word document',
            type: 'file', accept: '.pdf',
            controls: []
        },
        'pdf-to-images': {
            t: 'PDF to Images', d: 'Convert each PDF page to a PNG image',
            type: 'file', accept: '.pdf',
            controls: [
                { type: 'range', id: 'pdf-img-scale', label: 'Output Resolution', min: 1, max: 4, step: 0.5, value: 2 }
            ]
        },
        'pdf-to-text': {
            t: 'PDF to Text', d: 'Extract all text content from PDF',
            type: 'file', accept: '.pdf',
            controls: []
        },
        'split-pdf': {
            t: 'Split PDF', d: 'Split PDF into individual pages',
            type: 'file', accept: '.pdf',
            controls: []
        },
        'delete-pages': {
            t: 'Delete Pages', d: 'Remove specific pages from your PDF',
            type: 'file', accept: '.pdf',
            controls: [
                { type: 'text', id: 'delete-pages-input', label: 'Pages to delete (e.g. 1, 3, 5-7)', placeholder: 'e.g. 1, 3, 5-7' }
            ]
        },
        'extract-pages': {
            t: 'Extract Pages', d: 'Extract selected pages into a new PDF',
            type: 'file', accept: '.pdf',
            controls: [
                { type: 'text', id: 'extract-pages-input', label: 'Pages to extract (e.g. 1, 3, 5-7)', placeholder: 'e.g. 1, 3, 5-7' }
            ]
        },
        'rotate-pdf': {
            t: 'Rotate PDF', d: 'Rotate all pages in your PDF',
            type: 'file', accept: '.pdf',
            controls: []
        },
        'resize-pdf': {
            t: 'Resize PDF', d: 'Change PDF page size',
            type: 'file', accept: '.pdf',
            controls: [
                { type: 'select', id: 'pdf-size', label: 'Page Size', options: [
                    { value: 'A4', text: 'A4 (210 × 297 mm)' },
                    { value: 'A3', text: 'A3 (297 × 420 mm)' },
                    { value: 'Letter', text: 'Letter (8.5 × 11 in)' },
                    { value: 'Legal', text: 'Legal (8.5 × 14 in)' }
                ]}
            ]
        },
        'page-numbers': {
            t: 'Add Page Numbers', d: 'Add page numbers to your PDF',
            type: 'file', accept: '.pdf',
            controls: [
                { type: 'select', id: 'num-position', label: 'Position', options: [
                    { value: 'bottom-center', text: 'Bottom Center' },
                    { value: 'bottom-right', text: 'Bottom Right' },
                    { value: 'top-center', text: 'Top Center' }
                ]}
            ]
        },
        'extract-images': {
            t: 'Extract Images', d: 'Extract images from PDF pages',
            type: 'file', accept: '.pdf',
            controls: []
        },
        'protect-pdf': {
            t: 'Protect PDF', d: 'Add password protection to PDF',
            type: 'file', accept: '.pdf',
            controls: [
                { type: 'password', id: 'protect-password', label: 'Password', placeholder: 'Enter password' }
            ]
        },
        'unlock-pdf': {
            t: 'Unlock PDF', d: 'Remove password from PDF',
            type: 'file', accept: '.pdf',
            controls: [
                { type: 'password', id: 'unlock-password', label: 'Current Password', placeholder: 'Enter current password' }
            ]
        },
        'resize-image': {
            t: 'Resize Image', d: 'Resize image by width or percentage',
            type: 'file', accept: '.png,.jpg,.jpeg,.webp',
            controls: [
                { type: 'radio', id: 'resize-mode', label: 'Mode', options: [
                    { value: 'width', text: 'By Width' },
                    { value: 'percentage', text: 'By Percentage' }
                ]},
                { type: 'number', id: 'resize-value', label: 'Width (px)', placeholder: '800', value: '800' }
            ]
        },
        'compress-image': {
            t: 'Compress Image', d: 'Reduce image file size',
            type: 'file', accept: '.png,.jpg,.jpeg,.webp',
            controls: [
                { type: 'range', id: 'compress-quality', label: 'Quality', min: 10, max: 100, step: 5, value: 70 }
            ]
        },
        'convert-format': {
            t: 'Convert Image Format', d: 'Convert between image formats',
            type: 'file', accept: '.png,.jpg,.jpeg,.webp',
            controls: [
                { type: 'select', id: 'convert-format', label: 'Output Format', options: [
                    { value: 'jpg', text: 'JPEG' },
                    { value: 'png', text: 'PNG' },
                    { value: 'webp', text: 'WebP' }
                ]}
            ]
        },
        'crop-image': {
            t: 'Crop Image', d: 'Crop image to specific dimensions',
            type: 'file', accept: '.png,.jpg,.jpeg,.webp',
            controls: [
                { type: 'grid', columns: 2, items: [
                    { type: 'number', id: 'crop-x', label: 'X Position', value: '0' },
                    { type: 'number', id: 'crop-y', label: 'Y Position', value: '0' },
                    { type: 'number', id: 'crop-w', label: 'Width', value: '200' },
                    { type: 'number', id: 'crop-h', label: 'Height', value: '200' }
                ]}
            ]
        },
        'rotate-flip': {
            t: 'Rotate / Flip Image', d: 'Rotate or flip image',
            type: 'file', accept: '.png,.jpg,.jpeg,.webp',
            controls: [
                { type: 'select', id: 'flip-action', label: 'Action', options: [
                    { value: 'rotate90', text: 'Rotate 90° CW' },
                    { value: 'rotate180', text: 'Rotate 180°' },
                    { value: 'rotate270', text: 'Rotate 90° CCW' },
                    { value: 'flipH', text: 'Flip Horizontal' },
                    { value: 'flipV', text: 'Flip Vertical' }
                ]}
            ]
        },
        'add-watermark-image': {
            t: 'Add Watermark', d: 'Add text watermark to image',
            type: 'file', accept: '.png,.jpg,.jpeg,.webp',
            controls: [
                { type: 'text', id: 'watermark-text', label: 'Watermark Text', placeholder: 'CONFIDENTIAL', value: 'CONFIDENTIAL' },
                { type: 'range', id: 'watermark-opacity', label: 'Opacity', min: 10, max: 100, step: 5, value: 30 }
            ]
        },
        'remove-background': {
            t: 'Remove Background', d: 'Remove solid color background from images',
            type: 'file', accept: '.png,.jpg,.jpeg,.webp',
            controls: [],
            note: 'Works best with solid color backgrounds'
        },
        'json-formatter': {
            t: 'JSON Formatter', d: 'Format and validate JSON data',
            type: 'text', placeholder: 'Paste your JSON here...'
        },
        'csv-json': {
            t: 'CSV ↔ JSON Converter', d: 'Convert between CSV and JSON formats',
            type: 'text', placeholder: 'Paste CSV or JSON here...'
        },
        'base64': {
            t: 'Base64 Encoder/Decoder', d: 'Encode or decode Base64 strings',
            type: 'text', placeholder: 'Enter text to encode or Base64 to decode...'
        },
        'url-encode': {
            t: 'URL Encoder/Decoder', d: 'Encode or decode URL strings',
            type: 'text', placeholder: 'Enter URL to encode or encoded URL to decode...'
        },
        'word-counter': {
            t: 'Word Counter', d: 'Count words, characters, and sentences',
            type: 'text', placeholder: 'Paste your text here...'
        },
        'markdown-preview': {
            t: 'Markdown Preview', d: 'Preview Markdown as formatted HTML',
            type: 'text', placeholder: 'Enter Markdown text...'
        },
        'calculator': {
            t: 'Calculator', d: 'Scientific calculator with advanced functions',
            type: 'scientific-calc'
        },
        'unit-converter': {
            t: 'Unit Converter', d: 'Convert between different units of measurement',
            type: 'unit',
            controls: [
                { type: 'select', id: 'unit-category', label: 'Category', options: [
                    { value: 'length', text: 'Length' },
                    { value: 'weight', text: 'Weight' },
                    { value: 'temperature', text: 'Temperature' },
                    { value: 'volume', text: 'Volume' }
                ]},
                { type: 'select', id: 'unit-from', label: 'From', options: [
                    { value: 'm', text: 'Meter (m)' },
                    { value: 'km', text: 'Kilometer (km)' },
                    { value: 'cm', text: 'Centimeter (cm)' },
                    { value: 'mm', text: 'Millimeter (mm)' },
                    { value: 'ft', text: 'Foot (ft)' },
                    { value: 'in', text: 'Inch (in)' },
                    { value: 'mi', text: 'Mile (mi)' }
                ]},
                { type: 'select', id: 'unit-to', label: 'To', options: [
                    { value: 'ft', text: 'Foot (ft)' },
                    { value: 'm', text: 'Meter (m)' },
                    { value: 'km', text: 'Kilometer (km)' },
                    { value: 'cm', text: 'Centimeter (cm)' },
                    { value: 'mm', text: 'Millimeter (mm)' },
                    { value: 'in', text: 'Inch (in)' },
                    { value: 'mi', text: 'Mile (mi)' }
                ]},
                { type: 'number', id: 'unit-value', label: 'Value', value: '1', placeholder: 'Enter value' }
            ]
        },
        'percentage-calc': {
            t: 'Percentage Calculator', d: 'Calculate percentages quickly',
            type: 'percentage',
            controls: [
                { type: 'select', id: 'pct-mode', label: 'Mode', options: [
                    { value: 'what-is', text: 'What is X% of Y?' },
                    { value: 'is-what-pct', text: 'X is what % of Y?' },
                    { value: 'pct-change', text: 'Percentage change from X to Y' }
                ]},
                { type: 'number', id: 'pct-a', label: 'Value A', value: '50', placeholder: 'First value' },
                { type: 'number', id: 'pct-b', label: 'Value B', value: '200', placeholder: 'Second value' }
            ]
        },
        'date-calculator': {
            t: 'Date Calculator', d: 'Calculate difference between dates or add/subtract days',
            type: 'date',
            controls: [
                { type: 'select', id: 'date-mode', label: 'Mode', options: [
                    { value: 'diff', text: 'Difference between dates' },
                    { value: 'add', text: 'Add/Subtract days' }
                ]},
                { type: 'date', id: 'date-from', label: 'From Date' },
                { type: 'date', id: 'date-to', label: 'To Date' },
                { type: 'number', id: 'date-days', label: 'Days to add/subtract', value: '30', placeholder: 'Positive or negative' }
            ]
        },
        'color-converter': {
            t: 'Color Converter', d: 'Convert HEX to RGB colors',
            type: 'color', placeholder: 'Enter HEX color (e.g., #3b82f6)...'
        },
        'generate-qr': {
            t: 'Generate QR Code', d: 'Create QR codes from text or URLs',
            type: 'text', placeholder: 'Enter text or URL to generate QR code...'
        },
        'read-qr': {
            t: 'Read QR Code', d: 'Decode QR codes from images',
            type: 'file', accept: '.png,.jpg,.jpeg',
            controls: []
        }
    };
    
    var config = toolConfigs[toolId] || { t: 'Tool', d: '', type: 'file' };
    if (title) title.textContent = config.t;
    if (desc) desc.textContent = config.d;
    
    // Create upload zone with preview - stacked layout
    var html = '<div class="gt-tool-container">';
    
    // Main layout: single column, stacked
    html += '<div class="gt-main-layout">';
    
    // Top: Preview area (takes most space)
    html += '<div class="gt-preview-area">';
    
    // Upload area
    html += '<div class="gt-upload-area" id="gt-upload-zone">';
    html += '<input type="file" id="gt-file-input" accept="' + (config.accept || '*') + '" style="display:none;" />';
    html += '<div class="gt-upload-content" id="gt-upload-content">';
    html += '<div class="gt-upload-icon"><i class="ph ph-upload-simple"></i></div>';
    html += '<h3 class="gt-upload-title">Drop your file here</h3>';
    html += '<p class="gt-upload-subtitle">or click to browse</p>';
    html += '<button class="gt-browse-btn" id="gt-browse-btn"><i class="ph ph-folder-open"></i> Choose File</button>';
    html += '</div>';
    html += '<div class="gt-file-preview" id="gt-file-preview" style="display:none;">';
    html += '<div class="gt-file-info">';
    html += '<div class="gt-file-icon"><i class="ph ph-file"></i></div>';
    html += '<div class="gt-file-details">';
    html += '<p class="gt-file-name" id="gt-file-name"></p>';
    html += '<p class="gt-file-size" id="gt-file-size"></p>';
    html += '</div>';
    html += '<button class="gt-remove-file" id="gt-remove-file"><i class="ph ph-x"></i></button>';
    html += '</div>';
    // Image preview
    html += '<div class="gt-image-preview" id="gt-image-preview" style="display:none;">';
    html += '<img id="gt-preview-img" src="" alt="Preview" />';
    html += '</div>';
    // Data preview container (for PDF canvas, text, etc)
    html += '<div class="gt-data-preview" id="gt-data-preview" style="display:none;"></div>';
    html += '</div>';
    html += '</div>';
    
    // Rotation toolbar
    html += '<div class="gt-rotate-toolbar" id="gt-rotate-toolbar" style="display:none;">';
    html += '<button class="gt-rotate-btn" id="gt-rotate-ccw" title="Rotate Left"><i class="ph ph-arrow-counter-clockwise"></i></button>';
    html += '<span class="gt-rotate-label" id="gt-rotate-label">0°</span>';
    html += '<button class="gt-rotate-btn" id="gt-rotate-cw" title="Rotate Right"><i class="ph ph-arrow-clockwise"></i></button>';
    html += '</div>';
    
    html += '</div>';
    
    // Bottom: Controls + Process button (compact)
    html += '<div class="gt-control-area">';
    
    // Controls section (inline, no "Settings" header)
    if (config.controls && config.controls.length > 0) {
        html += '<div class="gt-controls-inline" id="gt-controls" style="display:none;">';
        
        config.controls.forEach(function(ctrl) {
            if (ctrl.type === 'grid') {
                html += '<div class="gt-control-grid" style="display:grid; grid-template-columns:repeat(' + (ctrl.columns || 2) + ', 1fr); gap:12px;">';
                ctrl.items.forEach(function(item) {
                    html += '<div class="gt-control-item">';
                    html += '<label class="gt-label">' + item.label + '</label>';
                    html += '<input type="number" id="gt-' + item.id + '" class="gt-input-field" value="' + (item.value || '') + '" placeholder="' + (item.placeholder || '') + '" />';
                    html += '</div>';
                });
                html += '</div>';
            } else if (ctrl.type === 'select') {
                html += '<div class="gt-control-item">';
                html += '<label class="gt-label">' + ctrl.label + '</label>';
                html += '<select id="gt-' + ctrl.id + '" class="gt-select">';
                ctrl.options.forEach(function(opt) {
                    html += '<option value="' + opt.value + '">' + opt.text + '</option>';
                });
                html += '</select>';
                html += '</div>';
            } else if (ctrl.type === 'range') {
                html += '<div class="gt-control-item">';
                html += '<label class="gt-label">' + ctrl.label + ': <span id="gt-' + ctrl.id + '-value">' + ctrl.value + '</span></label>';
                html += '<input type="range" id="gt-' + ctrl.id + '" class="gt-range" min="' + ctrl.min + '" max="' + ctrl.max + '" step="' + (ctrl.step || 1) + '" value="' + ctrl.value + '" />';
                html += '</div>';
            } else if (ctrl.type === 'radio') {
                html += '<div class="gt-control-item">';
                html += '<label class="gt-label">' + ctrl.label + '</label>';
                html += '<div class="gt-radio-group">';
                ctrl.options.forEach(function(opt, idx) {
                    html += '<label class="gt-radio-label"><input type="radio" name="gt-' + ctrl.id + '" value="' + opt.value + '"' + (idx === 0 ? ' checked' : '') + ' onchange="window._gtRadioChange && window._gtRadioChange(\'' + ctrl.id + '\', this.value)" /> ' + opt.text + '</label>';
                });
                html += '</div>';
                html += '</div>';
            } else if (ctrl.type === 'text') {
                html += '<div class="gt-control-item">';
                html += '<label class="gt-label">' + ctrl.label + '</label>';
                html += '<input type="text" id="gt-' + ctrl.id + '" class="gt-input-field" value="' + (ctrl.value || '') + '" placeholder="' + (ctrl.placeholder || '') + '" />';
                html += '</div>';
            } else if (ctrl.type === 'password') {
                html += '<div class="gt-control-item">';
                html += '<label class="gt-label">' + ctrl.label + '</label>';
                html += '<div class="gt-password-wrap">';
                html += '<input type="password" id="gt-' + ctrl.id + '" class="gt-input-field" placeholder="' + (ctrl.placeholder || '') + '" />';
                html += '<button type="button" class="gt-pw-toggle" onclick="(function(btn){var inp=btn.previousElementSibling;var isHidden=inp.type===\'password\';inp.type=isHidden?\'text\':\'password\';btn.querySelector(\'i\').className=isHidden?\'ph ph-eye-slash\':\'ph ph-eye\';})(this)" title="Show/hide password"><i class="ph ph-eye"></i></button>';
                html += '</div>';
                html += '</div>';
            } else if (ctrl.type === 'number') {
                html += '<div class="gt-control-item">';
                html += '<label class="gt-label" id="lbl-gt-' + ctrl.id + '">' + ctrl.label + '</label>';
                html += '<input type="number" id="gt-' + ctrl.id + '" class="gt-input-field" value="' + (ctrl.value || '') + '" placeholder="' + (ctrl.placeholder || '') + '" oninput="(function(){var o=document.getElementById(\'gt-output\');if(o)o.innerHTML=\'\';})()" />';
                html += '</div>';
            } else if (ctrl.type === 'date') {
                html += '<div class="gt-control-item">';
                html += '<label class="gt-label">' + ctrl.label + '</label>';
                html += '<input type="date" id="gt-' + ctrl.id + '" class="gt-input-field" value="' + (ctrl.value || '') + '" />';
                html += '</div>';
            }
        });
        html += '</div>';
    }
    
    // Text input area
    if (config.type === 'text') {
        html += '<div class="gt-text-area">';
        html += '<textarea id="gt-text-input" class="gt-textarea" placeholder="' + (config.placeholder || 'Enter text...') + '"></textarea>';
        html += '</div>';
    }
    
    // Calc input
    if (config.type === 'calc') {
        html += '<div class="gt-calc-area">';
        html += '<input type="text" id="gt-calc-input" class="gt-calc-input" placeholder="' + (config.placeholder || 'Enter expression...') + '" />';
        html += '</div>';
    }
    
    // Color input
    if (config.type === 'color') {
        html += '<div class="gt-color-area">';
        html += '<div class="gt-color-input-wrapper">';
        html += '<input type="text" id="gt-color-input" class="gt-color-input" placeholder="' + (config.placeholder || '#3b82f6') + '" />';
        html += '<div class="gt-color-preview" id="gt-color-preview"></div>';
        html += '</div>';
        html += '</div>';
    }
    
    // Scientific Calculator
    if (config.type === 'scientific-calc') {
        html += '<div class="gt-scientific-calc">';
        html += '<div class="calc-display">';
        html += '<div class="calc-expression" id="calc-expression"></div>';
        html += '<div class="calc-result" id="calc-result">0</div>';
        html += '</div>';
        html += '<div class="calc-buttons">';
        // Row 1: Scientific functions
        html += '<button class="calc-btn calc-fn" data-val="sin(">sin</button>';
        html += '<button class="calc-btn calc-fn" data-val="cos(">cos</button>';
        html += '<button class="calc-btn calc-fn" data-val="tan(">tan</button>';
        html += '<button class="calc-btn calc-fn" data-val="log(">log</button>';
        html += '<button class="calc-btn calc-fn" data-val="ln(">ln</button>';
        html += '<button class="calc-btn calc-fn" data-val="sqrt(">√</button>';
        // Row 2: More scientific + clear
        html += '<button class="calc-btn calc-fn" data-val="^">xʸ</button>';
        html += '<button class="calc-btn calc-fn" data-val="^2">x²</button>';
        html += '<button class="calc-btn calc-fn" data-val="pi">π</button>';
        html += '<button class="calc-btn calc-fn" data-val="e">e</button>';
        html += '<button class="calc-btn calc-fn" data-val="!(">n!</button>';
        html += '<button class="calc-btn calc-clear" data-action="clear">AC</button>';
        // Row 3: Parentheses + operators
        html += '<button class="calc-btn calc-fn" data-val="(">(</button>';
        html += '<button class="calc-btn calc-fn" data-val=")">)</button>';
        html += '<button class="calc-btn calc-fn" data-val="%">%</button>';
        html += '<button class="calc-btn calc-fn" data-val="1/">1/x</button>';
        html += '<button class="calc-btn calc-op" data-val="/">÷</button>';
        html += '<button class="calc-btn calc-del" data-action="del">⌫</button>';
        // Row 4: 7 8 9 ×
        html += '<button class="calc-btn calc-num" data-val="7">7</button>';
        html += '<button class="calc-btn calc-num" data-val="8">8</button>';
        html += '<button class="calc-btn calc-num" data-val="9">9</button>';
        html += '<button class="calc-btn calc-op" data-val="*">×</button>';
        html += '<button class="calc-btn calc-num" data-val="." style="grid-column: span 2;">.</button>';
        // Row 5: 4 5 6 -
        html += '<button class="calc-btn calc-num" data-val="4">4</button>';
        html += '<button class="calc-btn calc-num" data-val="5">5</button>';
        html += '<button class="calc-btn calc-num" data-val="6">6</button>';
        html += '<button class="calc-btn calc-op" data-val="-">−</button>';
        html += '<button class="calc-btn calc-equals" data-action="equals" style="grid-row: span 2;">=</button>';
        // Row 6: 1 2 3 +
        html += '<button class="calc-btn calc-num" data-val="1">1</button>';
        html += '<button class="calc-btn calc-num" data-val="2">2</button>';
        html += '<button class="calc-btn calc-num" data-val="3">3</button>';
        html += '<button class="calc-btn calc-op" data-val="+">+</button>';
        // Row 7: 0 (wide)
        html += '<button class="calc-btn calc-num" data-val="0" style="grid-column: span 2;">0</button>';
        html += '<button class="calc-btn calc-num" data-val="+/-">±</button>';
        html += '<button class="calc-btn calc-fn" data-val="abs(">|x|</button>';
        html += '</div>';
        html += '</div>';
    }
    
    // Note
    if (config.note) {
        html += '<div class="gt-note"><i class="ph ph-info"></i> ' + config.note + '</div>';
    }
    
    // Process button
    html += '<div class="gt-actions">';
    html += '<button class="gt-process-btn" id="gt-process-btn" disabled><i class="ph ph-gear"></i> Process</button>';
    html += '</div>';
    
    html += '</div>'; // End control area
    html += '</div>'; // End main layout
    
    // Output area
    html += '<div class="gt-output" id="gt-output"></div>';
    
    html += '</div>';
    container.innerHTML = html;
    
    // Setup event listeners
    var uploadZone = document.getElementById('gt-upload-zone');
    var fileInput = document.getElementById('gt-file-input');
    var browseBtn = document.getElementById('gt-browse-btn');
    var uploadContent = document.getElementById('gt-upload-content');
    var filePreview = document.getElementById('gt-file-preview');
    var fileName = document.getElementById('gt-file-name');
    var fileSize = document.getElementById('gt-file-size');
    var removeFile = document.getElementById('gt-remove-file');
    var controls = document.getElementById('gt-controls');
    var processBtn = document.getElementById('gt-process-btn');
    var output = document.getElementById('gt-output');
    var imagePreview = document.getElementById('gt-image-preview');
    var previewImg = document.getElementById('gt-preview-img');
    
    var selectedFile = null;
    
    // Enable process button immediately for non-file tools
    if (config.type !== 'file') {
        processBtn.disabled = false;
        // Hide upload zone for non-file tools
        if (uploadZone) uploadZone.style.display = 'none';
    }
    
    // Scientific calculator: hide process button and output (calculates live)
    if (config.type === 'scientific-calc') {
        if (processBtn) processBtn.style.display = 'none';
        if (output) output.style.display = 'none';
    }
    
    // Browse button
    if (browseBtn) {
        browseBtn.onclick = function(e) { 
            e.preventDefault();
            e.stopPropagation(); 
            fileInput.click(); 
        };
    }
    
    // Upload zone click - only trigger file dialog when clicking the upload area
    if (uploadZone) {
        uploadZone.onclick = function(e) {
            // Don't trigger if file preview is showing
            if (filePreview && filePreview.style.display !== 'none') return;
            fileInput.click();
        };
    }
    
    // Drag and drop
    if (uploadZone) {
        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
    }
    
    // File input change
    if (fileInput) {
        fileInput.onchange = function() {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0]);
            }
        };
    }
    
    // Remove file
    if (removeFile) {
        removeFile.onclick = function(e) {
            e.stopPropagation();
            selectedFile = null;
            fileInput.value = '';
            uploadContent.style.display = '';
            filePreview.style.display = 'none';
            if (uploadZone) uploadZone.classList.remove('has-file');
            imagePreview.style.display = 'none';
            if (controls) controls.style.display = 'none';
            processBtn.disabled = true;
            output.innerHTML = '';
            if (window._pdfBlobUrl) { URL.revokeObjectURL(window._pdfBlobUrl); window._pdfBlobUrl = null; }
            // Hide rotation toolbar
            var rotateToolbar = document.getElementById('gt-rotate-toolbar');
            if (rotateToolbar) rotateToolbar.style.display = 'none';
        };
    }
    
    function handleFile(file) {
        selectedFile = file;
        uploadContent.style.display = 'none';
        filePreview.style.display = '';
        if (uploadZone) uploadZone.classList.add('has-file');
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        
        // Show controls and hide image preview
        if (controls) controls.style.display = '';
        imagePreview.style.display = 'none';

        // Show data preview based on file type - insert inside dedicated preview container
        var dataPreview = document.getElementById('gt-data-preview');
        if (dataPreview) {
            dataPreview.style.display = '';
            showDataPreview(file, dataPreview);
            // Scroll to top after content loads
            setTimeout(function() {
                var container = dataPreview.querySelector('.gt-preview-content') || 
                               dataPreview.querySelector('.docx-page-container') ||
                               dataPreview;
                if (container) container.scrollTop = 0;
            }, 100);
        }
        
        processBtn.disabled = false;
    }
    
    // Store current preview rotation and file
    window._currentPreviewRotation = 0;
    window._currentPreviewFile = null;
    window._pdfArrayBuffer = null;
    if (window._pdfBlobUrl) { URL.revokeObjectURL(window._pdfBlobUrl); window._pdfBlobUrl = null; }
    
    // Show data preview for files
    function showDataPreview(file, outputElement) {
        if (!outputElement) return;
        
        // Store file reference globally for rotation
        window._currentPreviewFile = file;
        window._currentPreviewRotation = 0;
        
        // PDF preview with live rotation — shows all pages
        if (file.name.toLowerCase().endsWith('.pdf')) {
            outputElement.innerHTML = '<div class="gt-preview-container"><div class="gt-pdf-page-info" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;text-align:center;">Loading preview...</div><div id="gt-pdf-multipage" style="display:flex;flex-direction:column;gap:10px;align-items:center;max-height:520px;overflow-y:auto;padding:4px;"></div></div>';

            // Use a Blob URL — can be passed to PDF.js repeatedly without ArrayBuffer transfer issues
            if (window._pdfBlobUrl) URL.revokeObjectURL(window._pdfBlobUrl);
            window._pdfBlobUrl = URL.createObjectURL(file);
            window._currentPreviewRotation = 0;

            // Show rotation toolbar
            var rotateToolbar = document.getElementById('gt-rotate-toolbar');
            if (rotateToolbar) rotateToolbar.style.display = 'flex';

            // Render preview at 0° immediately
            renderPdfWithRotation(0);

            // Wire up rotate buttons
            var btnCCW = document.getElementById('gt-rotate-ccw');
            var btnCW  = document.getElementById('gt-rotate-cw');
            var label  = document.getElementById('gt-rotate-label');

            if (btnCCW) {
                btnCCW.addEventListener('click', function(ev) {
                    ev.stopPropagation(); ev.preventDefault();
                    window._currentPreviewRotation = (window._currentPreviewRotation - 90 + 360) % 360;
                    if (label) label.textContent = window._currentPreviewRotation + '°';
                    renderPdfWithRotation(window._currentPreviewRotation);
                });
            }
            if (btnCW) {
                btnCW.addEventListener('click', function(ev) {
                    ev.stopPropagation(); ev.preventDefault();
                    window._currentPreviewRotation = (window._currentPreviewRotation + 90) % 360;
                    if (label) label.textContent = window._currentPreviewRotation + '°';
                    renderPdfWithRotation(window._currentPreviewRotation);
                });
            }
        }
        // Image preview
        else if (file.type.startsWith('image/')) {
            outputElement.innerHTML = '<div class="gt-preview-container"><div class="gt-preview-content"><img src="" id="gt-image-preview-full" style="max-width:100%; max-height:400px; border-radius:var(--radius-sm);" /></div><div class="gt-preview-info" id="gt-image-info"></div></div>';
            var reader = new FileReader();
            reader.onload = function(e) {
                var imgPreview = document.getElementById('gt-image-preview-full');
                if (imgPreview) {
                    imgPreview.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
            // Show image dimensions
            var img = new Image();
            img.onload = function() {
                var infoDiv = document.getElementById('gt-image-info');
                if (infoDiv) {
                    infoDiv.innerHTML = '<span class="gt-info-badge">' + img.width + ' × ' + img.height + ' px</span>';
                }
            };
            img.src = URL.createObjectURL(file);
        }
        // Text preview
        else if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|csv|json|xml|html|css|js)$/i)) {
            outputElement.innerHTML = '<div class="gt-preview-container"><div class="gt-preview-content"><pre class="gt-text-preview" id="gt-text-preview"></pre></div></div>';
            var reader = new FileReader();
            reader.onload = function(e) {
                var textPreview = document.getElementById('gt-text-preview');
                if (textPreview) {
                    var text = e.target.result;
                    var maxLength = 3000;
                    var displayText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
                    textPreview.textContent = displayText;
                    if (text.length > maxLength) {
                        textPreview.innerHTML += '<div class="gt-preview-more">+' + (text.length - maxLength) + ' more characters</div>';
                    }
                }
            };
            reader.readAsText(file);
        }
        // DOCX preview
        else if (file.name.toLowerCase().endsWith('.docx')) {
            outputElement.innerHTML = '<div class="gt-preview-container docx-page-container"><div class="docx-page" id="gt-docx-preview"><div class="docx-loading"><i class="ph ph-spinner ph-spin"></i> Loading document...</div></div></div>';
            var reader = new FileReader();
            reader.onload = function(e) {
                mammoth.convertToHtml({ arrayBuffer: e.target.result }, {
                    styleMap: [
                        "p[style-name='Title'] => h1:fresh",
                        "p[style-name='Heading 1'] => h1:fresh",
                        "p[style-name='Heading 2'] => h2:fresh",
                        "p[style-name='Heading 3'] => h3:fresh",
                        "p[style-name='Heading 4'] => h4:fresh",
                        "p[style-name='Heading 5'] => h5:fresh",
                        "p[style-name='Heading 6'] => h6:fresh",
                        "p[style-name='Normal'] => p:fresh",
                        "r[style-name='Strong'] => strong:fresh",
                        "r[style-name='Emphasis'] => em:fresh"
                    ]
                }).then(function(result) {
                    var previewDiv = document.getElementById('gt-docx-preview');
                    if (previewDiv) {
                        var html = result.value;
                        // Add Word-like styling inline
                        html = html.replace(/<h1/g, '<h1 style="font-family:Calibri,sans-serif;font-size:24pt;font-weight:bold;margin:0 0 12pt 0;color:#1a1a1a;"');
                        html = html.replace(/<h2/g, '<h2 style="font-family:Calibri,sans-serif;font-size:18pt;font-weight:bold;margin:14pt 0 8pt 0;color:#1a1a1a;"');
                        html = html.replace(/<h3/g, '<h3 style="font-family:Calibri,sans-serif;font-size:14pt;font-weight:bold;margin:12pt 0 6pt 0;color:#1a1a1a;"');
                        html = html.replace(/<p/g, '<p style="font-family:Calibri,sans-serif;font-size:11pt;margin:0 0 8pt 0;line-height:1.5;color:#1a1a1a;"');
                        html = html.replace(/<ul/g, '<ul style="font-family:Calibri,sans-serif;font-size:11pt;margin:0 0 8pt 0;padding-left:24pt;"');
                        html = html.replace(/<ol/g, '<ol style="font-family:Calibri,sans-serif;font-size:11pt;margin:0 0 8pt 0;padding-left:24pt;"');
                        html = html.replace(/<li/g, '<li style="margin-bottom:4pt;"');
                        html = html.replace(/<strong/g, '<strong style="font-weight:bold;"');
                        html = html.replace(/<em/g, '<em style="font-style:italic;"');
                        html = html.replace(/<table/g, '<table style="border-collapse:collapse;margin:8pt 0;width:100%;font-family:Calibri,sans-serif;font-size:11pt;"');
                        html = html.replace(/<th/g, '<th style="border:1px solid #bfbfbf;padding:6pt 8pt;background:#f3f3f3;font-weight:bold;text-align:left;"');
                        html = html.replace(/<td/g, '<td style="border:1px solid #bfbfbf;padding:6pt 8pt;"');
                        previewDiv.innerHTML = '<div class="docx-content">' + html + '</div>';
                        // Scroll to top
                        var container = previewDiv.closest('.gt-preview-content') || previewDiv.closest('.docx-page-container');
                        if (container) container.scrollTop = 0;
                    }
                }).catch(function(err) {
                    var previewDiv = document.getElementById('gt-docx-preview');
                    if (previewDiv) previewDiv.innerHTML = '<div class="docx-error">Error loading preview: ' + err.message + '</div>';
                });
            };
            reader.readAsArrayBuffer(file);
        }
        // XLSX/CSV preview
        else if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
            outputElement.innerHTML = '<div class="gt-preview-container"><div class="gt-preview-content"><pre class="gt-text-preview" id="gt-xlsx-preview">Loading preview...</pre></div></div>';
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = new Uint8Array(e.target.result);
                    var wb = XLSX.read(data, { type: 'array' });
                    var text = '';
                    var sheetName = wb.SheetNames[0];
                    var sheet = wb.Sheets[sheetName];
                    text = '=== ' + sheetName + ' ===\n';
                    text += XLSX.utils.sheet_to_csv(sheet);
                    var textPreview = document.getElementById('gt-xlsx-preview');
                    if (textPreview) {
                        var maxLength = 500;
                        var displayText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
                        textPreview.textContent = displayText;
                        if (text.length > maxLength) {
                            textPreview.innerHTML += '<div class="gt-preview-more">+' + (text.length - maxLength) + ' more characters</div>';
                        }
                    }
                } catch(err) {
                    var textPreview = document.getElementById('gt-xlsx-preview');
                    if (textPreview) textPreview.textContent = 'Error loading preview: ' + err.message;
                }
            };
            reader.readAsArrayBuffer(file);
        }
        // PPTX preview
        else if (file.name.toLowerCase().endsWith('.pptx')) {
            outputElement.innerHTML = '<div class="gt-preview-container"><div class="gt-preview-content"><pre class="gt-text-preview" id="gt-pptx-preview">Loading preview...</pre></div></div>';
            var reader = new FileReader();
            reader.onload = function(e) {
                JSZip.loadAsync(e.target.result).then(function(zip) {
                    var text = '';
                    var slideFiles = [];
                    zip.forEach(function(path, entry) {
                        var m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
                        if (m) slideFiles.push({ num: parseInt(m[1]), entry: entry });
                    });
                    slideFiles.sort(function(a, b) { return a.num - b.num; });
                    var promises = slideFiles.slice(0, 3).map(function(slide) {
                        return slide.entry.async('text').then(function(xml) {
                            var matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
                            var slideText = matches.map(function(t) {
                                return t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                            }).filter(function(s) { return s.trim(); }).join(' ');
                            text += 'Slide ' + slide.num + ': ' + slideText + '\n';
                        });
                    });
                    return Promise.all(promises).then(function() { return text; });
                }).then(function(text) {
                    var textPreview = document.getElementById('gt-pptx-preview');
                    if (textPreview) {
                        var maxLength = 500;
                        var displayText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
                        textPreview.textContent = displayText;
                        if (text.length > maxLength) {
                            textPreview.innerHTML += '<div class="gt-preview-more">+' + (text.length - maxLength) + ' more characters</div>';
                        }
                    }
                }).catch(function(err) {
                    var textPreview = document.getElementById('gt-pptx-preview');
                    if (textPreview) textPreview.textContent = 'Error loading preview: ' + err.message;
                });
            };
            reader.readAsArrayBuffer(file);
        }
    }
    
    
    // Render PDF preview using Blob URL — shows ALL pages with correct format
    function renderPdfWithRotation(rotation) {
        if (!window._pdfBlobUrl) return;
        if (typeof pdfjsLib === 'undefined') return;
        var url = window._pdfBlobUrl;
        var container = document.getElementById('gt-data-preview');
        pdfjsLib.getDocument(url).promise.then(function(pdf) {
            var numPages = pdf.numPages;
            // Build multi-page container
            var wrapper = document.getElementById('gt-pdf-multipage');
            if (!wrapper) {
                if (container) {
                    container.innerHTML =
                        '<div class="gt-preview-container">' +
                        '<div class="gt-pdf-page-info" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;text-align:center;">' + numPages + ' page(s)</div>' +
                        '<div id="gt-pdf-multipage" style="display:flex;flex-direction:column;gap:10px;align-items:center;max-height:520px;overflow-y:auto;padding:4px;"></div>' +
                        '</div>';
                    wrapper = document.getElementById('gt-pdf-multipage');
                } else {
                    return;
                }
            } else {
                wrapper.innerHTML = '';
                var infoEl = wrapper.previousElementSibling;
                if (infoEl) infoEl.textContent = numPages + ' page(s)';
            }
            // Render each page sequentially
            var renderPage = function(pageNum) {
                return pdf.getPage(pageNum).then(function(page) {
                    var viewport = page.getViewport({ scale: 1.2, rotation: rotation || 0 });
                    var canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.style.maxWidth = '100%';
                    canvas.style.height = 'auto';
                    canvas.style.borderRadius = '4px';
                    canvas.style.border = '1px solid var(--border-color)';
                    canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.10)';
                    var ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
                        var pageWrap = document.createElement('div');
                        pageWrap.style.cssText = 'position:relative;';
                        var label = document.createElement('div');
                        label.style.cssText = 'text-align:center;font-size:11px;color:var(--text-muted);margin-bottom:3px;';
                        label.textContent = 'Page ' + pageNum;
                        pageWrap.appendChild(label);
                        pageWrap.appendChild(canvas);
                        if (wrapper) wrapper.appendChild(pageWrap);
                    });
                });
            };
            // Render all pages sequentially
            var chain = Promise.resolve();
            for (var p = 1; p <= numPages; p++) {
                (function(pn) {
                    chain = chain.then(function() { return renderPage(pn); });
                })(p);
            }
            return chain;
        }).catch(function(err) {
            console.warn('PDF preview error:', err);
        });
    }
    
    // Range slider value display
    document.querySelectorAll('.gt-range').forEach(function(range) {
        range.oninput = function() {
            var valueSpan = document.getElementById(this.id + '-value');
            if (valueSpan) valueSpan.textContent = this.value;
        };
    });
    
    // Color preview
    var colorInput = document.getElementById('gt-color-input');
    var colorPreview = document.getElementById('gt-color-preview');
    if (colorInput && colorPreview) {
        colorInput.oninput = function() {
            var val = this.value;
            if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
                colorPreview.style.background = val;
            }
        };
    }
    
    // Helper: Show success toast notification (global)
    window.showSuccessToast = function(message, downloadUrl, downloadName, outputEl) {
        var existingToast = document.querySelector('.success-toast');
        if (existingToast) existingToast.remove();
        if (outputEl) outputEl.innerHTML = '';
        var toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.innerHTML = 
            '<h4><i class="ph ph-check-circle"></i> Success!</h4>' +
            '<p>' + message + '</p>' +
            '<a href="' + downloadUrl + '" download="' + downloadName + '" class="btn-download"><i class="ph ph-download-simple"></i> Download</a>';
        if (outputEl) outputEl.appendChild(toast);
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 10000);
    };
    
    // Process button
    if (processBtn) {
        processBtn.onclick = function() {
            if (config.type === 'file' && !selectedFile) {
                alert('Please select a file first');
                return;
            }
            
            // Clear any existing toast
            var existingToast = document.querySelector('.success-toast');
            if (existingToast) existingToast.remove();
            
            if (config.type === 'file') {
                processFileTool(toolId, selectedFile, output);
            } else if (config.type === 'text') {
                var textInput = document.getElementById('gt-text-input');
                if (textInput && textInput.value) {
                    processTextTool(toolId, textInput.value, output);
                } else {
                    alert('Please enter some text');
                }
            } else if (config.type === 'calc') {
                var calcInput = document.getElementById('gt-calc-input');
                if (calcInput && calcInput.value) {
                    processCalcTool(toolId, calcInput.value, output);
                } else {
                    alert('Please enter an expression');
                }
            } else if (config.type === 'color') {
                var colorVal = document.getElementById('gt-color-input');
                if (colorVal && colorVal.value) {
                    processCalcTool(toolId, colorVal.value, output);
                } else {
                    alert('Please enter a color value');
                }
            } else if (config.type === 'unit') {
                processUnitTool(output);
            } else if (config.type === 'percentage') {
                processPercentageTool(output);
            } else if (config.type === 'date') {
                processDateTool(output);
            }
        };
    }
    
    // Unit converter: update From/To options when category changes
    var unitCategory = document.getElementById('gt-unit-category');
    if (unitCategory) {
        var unitOptions = {
            length: [
                { value: 'm', text: 'Meter (m)' }, { value: 'km', text: 'Kilometer (km)' },
                { value: 'cm', text: 'Centimeter (cm)' }, { value: 'mm', text: 'Millimeter (mm)' },
                { value: 'ft', text: 'Foot (ft)' }, { value: 'in', text: 'Inch (in)' }, { value: 'mi', text: 'Mile (mi)' }
            ],
            weight: [
                { value: 'kg', text: 'Kilogram (kg)' }, { value: 'g', text: 'Gram (g)' },
                { value: 'mg', text: 'Milligram (mg)' }, { value: 'lb', text: 'Pound (lb)' },
                { value: 'oz', text: 'Ounce (oz)' }, { value: 'ton', text: 'Metric Ton' }
            ],
            temperature: [
                { value: 'c', text: 'Celsius (°C)' }, { value: 'f', text: 'Fahrenheit (°F)' }, { value: 'k', text: 'Kelvin (K)' }
            ],
            volume: [
                { value: 'l', text: 'Liter (L)' }, { value: 'ml', text: 'Milliliter (mL)' },
                { value: 'gal', text: 'Gallon (gal)' }, { value: 'qt', text: 'Quart (qt)' },
                { value: 'pt', text: 'Pint (pt)' }, { value: 'cup', text: 'Cup' }, { value: 'floz', text: 'Fluid Ounce (fl oz)' }
            ]
        };
        
        function updateUnitOptions() {
            var cat = unitCategory.value;
            var options = unitOptions[cat] || [];
            var fromSelect = document.getElementById('gt-unit-from');
            var toSelect = document.getElementById('gt-unit-to');
            
            if (fromSelect) {
                fromSelect.innerHTML = options.map(function(opt, i) {
                    return '<option value="' + opt.value + '"' + (i === 0 ? ' selected' : '') + '>' + opt.text + '</option>';
                }).join('');
            }
            if (toSelect) {
                toSelect.innerHTML = options.map(function(opt, i) {
                    return '<option value="' + opt.value + '"' + (i === 1 ? ' selected' : '') + '>' + opt.text + '</option>';
                }).join('');
            }
        }
        
        unitCategory.addEventListener('change', updateUnitOptions);
        updateUnitOptions(); // Initialize
    }
    
    // Date calculator: set default dates
    var dateFrom = document.getElementById('gt-date-from');
    var dateTo = document.getElementById('gt-date-to');
    if (dateFrom && !dateFrom.value) {
        var today = new Date();
        dateFrom.value = today.toISOString().split('T')[0];
    }
    if (dateTo && !dateTo.value) {
        var future = new Date();
        future.setDate(future.getDate() + 30);
        dateTo.value = future.toISOString().split('T')[0];
    }
    
    // Scientific Calculator: button event handlers
    var calcDisplay = document.getElementById('calc-result');
    var calcExpr = document.getElementById('calc-expression');
    var calcExpression = '';
    var calcLastResult = '';
    
    if (calcDisplay) {
        document.querySelectorAll('.calc-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = this.dataset.val;
                var action = this.dataset.action;
                
                if (action === 'clear') {
                    calcExpression = '';
                    calcLastResult = '';
                    calcExpr.textContent = '';
                    calcDisplay.textContent = '0';
                    return;
                }
                
                if (action === 'del') {
                    calcExpression = calcExpression.slice(0, -1);
                    calcExpr.textContent = formatExpression(calcExpression);
                    if (calcExpression === '') calcDisplay.textContent = '0';
                    return;
                }
                
                if (action === 'equals') {
                    if (calcExpression) {
                        try {
                            var result = evaluateCalcExpression(calcExpression);
                            calcExpr.textContent = formatExpression(calcExpression) + ' =';
                            calcDisplay.textContent = formatResult(result);
                            calcLastResult = result.toString();
                            calcExpression = result.toString();
                        } catch(e) {
                            calcDisplay.textContent = 'Error';
                        }
                    }
                    return;
                }
                
                if (val === '+/-') {
                    // Toggle sign of last number
                    var match = calcExpression.match(/([\d.]+)$/);
                    if (match) {
                        var num = match[1];
                        var prefix = calcExpression.slice(0, -num.length);
                        if (num.startsWith('-')) {
                            calcExpression = prefix + num.slice(1);
                        } else {
                            calcExpression = prefix + '-' + num;
                        }
                        calcExpr.textContent = formatExpression(calcExpression);
                    }
                    return;
                }
                
                calcExpression += val;
                calcExpr.textContent = formatExpression(calcExpression);
                
                // Live preview
                try {
                    var preview = evaluateCalcExpression(calcExpression);
                    if (!isNaN(preview) && isFinite(preview)) {
                        calcDisplay.textContent = formatResult(preview);
                    }
                } catch(e) {}
            });
        });
        
        // Keyboard support
        document.addEventListener('keydown', function(e) {
            if (config.type !== 'scientific-calc') return;
            var key = e.key;
            if (key >= '0' && key <= '9') {
                calcExpression += key;
                calcExpr.textContent = formatExpression(calcExpression);
            } else if (key === '+' || key === '-' || key === '*' || key === '/') {
                calcExpression += key;
                calcExpr.textContent = formatExpression(calcExpression);
            } else if (key === '.') {
                calcExpression += '.';
                calcExpr.textContent = formatExpression(calcExpression);
            } else if (key === 'Enter' || key === '=') {
                e.preventDefault();
                if (calcExpression) {
                    try {
                        var result = evaluateCalcExpression(calcExpression);
                        calcExpr.textContent = formatExpression(calcExpression) + ' =';
                        calcDisplay.textContent = formatResult(result);
                        calcExpression = result.toString();
                    } catch(err) {
                        calcDisplay.textContent = 'Error';
                    }
                }
            } else if (key === 'Backspace') {
                calcExpression = calcExpression.slice(0, -1);
                calcExpr.textContent = formatExpression(calcExpression);
                if (calcExpression === '') calcDisplay.textContent = '0';
            } else if (key === 'Escape') {
                calcExpression = '';
                calcExpr.textContent = '';
                calcDisplay.textContent = '0';
            }
        });
    }
    
    function formatExpression(expr) {
        return expr
            .replace(/\*/g, '×')
            .replace(/\//g, '÷')
            .replace(/sqrt\(/g, '√(')
            .replace(/pi/g, 'π')
            .replace(/\^2/g, '²')
            .replace(/\^/g, '^');
    }
    
    function formatResult(num) {
        if (isNaN(num) || !isFinite(num)) return 'Error';
        if (Number.isInteger(num) && Math.abs(num) < 1e15) return num.toString();
        var str = num.toPrecision(10);
        return parseFloat(str).toString();
    }
    
    function factorial(n) {
        if (n < 0) return NaN;
        if (n === 0 || n === 1) return 1;
        if (n > 170) return Infinity;
        var result = 1;
        for (var i = 2; i <= n; i++) result *= i;
        return result;
    }
    
    function evaluateCalcExpression(expr) {
        // Replace mathematical functions and constants
        var processed = expr
            .replace(/sin\(/g, 'Math.sin(')
            .replace(/cos\(/g, 'Math.cos(')
            .replace(/tan\(/g, 'Math.tan(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/sqrt\(/g, 'Math.sqrt(')
            .replace(/abs\(/g, 'Math.abs(')
            .replace(/pi/g, 'Math.PI')
            .replace(/e(?![xp])/g, 'Math.E')
            .replace(/\^2/g, '**2')
            .replace(/\^/g, '**')
            .replace(/!(?!\()/g, ''); // Handle factorial
        
        // Handle factorial: find n! pattern
        processed = processed.replace(/(\d+)!/g, function(match, num) {
            return factorial(parseInt(num));
        });
        
        // Handle 1/x pattern
        processed = processed.replace(/1\/(\d+\.?\d*)/g, function(match, num) {
            return '(1/' + num + ')';
        });
        
        // Evaluate
        var result = eval(processed);
        return result;
    }
    
    // Store config for processFileTool to access
    window._currentToolConfig = config;
};

function processTextTool(id, val, out) {
    if (!val) return;
    try {
        if (id === 'json-formatter') {
            out.innerHTML = '<pre style="background:#1e293b; color:#fff; padding:16px; border-radius:8px; overflow-x:auto;">' + JSON.stringify(JSON.parse(val), null, 4) + '</pre>';
        } else if (id === 'base64') {
            if (val.trim().length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(val.trim())) {
                try { out.innerHTML = '<b>Decoded:</b><br/>' + atob(val.trim()); } catch(e) { out.innerHTML = '<b>Encoded:</b><br/>' + btoa(val); }
            } else {
                out.innerHTML = '<b>Encoded:</b><br/>' + btoa(val);
            }
        } else if (id === 'url-encode') {
            if (val.indexOf('%') !== -1) {
                out.innerHTML = '<b>Decoded:</b><br/>' + decodeURIComponent(val);
            } else {
                out.innerHTML = '<b>Encoded:</b><br/>' + encodeURIComponent(val);
            }
        } else if (id === 'word-counter') {
            var words = val.trim().split(/\s+/).filter(function(x) { return x.length > 0; }).length;
            var chars = val.length;
            var noSpace = val.replace(/\s/g, '').length;
            out.innerHTML = '<h3>' + words + ' Words | ' + chars + ' Characters (' + noSpace + ' without spaces)</h3>';
        } else if (id === 'markdown-preview') {
            if (typeof marked !== 'undefined') {
                out.innerHTML = '<div style="background:#fff; color:#000; padding:20px; border-radius:8px; border:1px solid #ccc; font-family:sans-serif;">' + marked.parse(val) + '</div>';
            } else { out.textContent = 'Marked library not loaded.'; }
        } else if (id === 'generate-qr') {
            out.innerHTML = '<canvas id="qr-canvas"></canvas>';
            try {
                generateQRCodeNative(document.getElementById('qr-canvas'), val, 250);
            } catch(e) {
                out.textContent = 'Error generating QR code: ' + e.message;
            }
        } else if (id === 'csv-json') {
            if (val.trim().startsWith('[') || val.trim().startsWith('{')) {
                // simple JSON to CSV
                var arr = JSON.parse(val);
                if (!Array.isArray(arr)) arr = [arr];
                if (arr.length > 0) {
                    var keys = Object.keys(arr[0]);
                    var csv = keys.join(',') + '\n' + arr.map(function(row) {
                        return keys.map(function(k) { return '"' + (row[k]||'') + '"'; }).join(',');
                    }).join('\n');
                    out.innerHTML = '<pre style="background:#1e293b; color:#fff; padding:16px;">' + csv + '</pre>';
                }
            } else {
                // simple CSV to JSON
                var lines = val.trim().split('\n');
                var hdrs = lines[0].split(',').map(function(h) { return h.replace(/"/g, '').trim(); });
                var res = [];
                for(var i=1; i<lines.length; i++) {
                    var obj = {};
                    var currentLine = lines[i].split(',');
                    for(var j=0; j<hdrs.length; j++) {
                        obj[hdrs[j]] = currentLine[j] ? currentLine[j].replace(/"/g, '').trim() : '';
                    }
                    res.push(obj);
                }
                out.innerHTML = '<pre style="background:#1e293b; color:#fff; padding:16px;">' + JSON.stringify(res, null, 4) + '</pre>';
            }
        }
    } catch(e) {
        out.innerHTML = '<span style="color:var(--danger)">Error: ' + e.message + '</span>';
    }
}

function processCalcTool(id, val, out) {
    if (!val) return;
    try {
        if (id === 'calculator') {
            // WARNING: eval used for simple demo purposes.
            out.textContent = 'Result: ' + eval(val.replace(/[^0-9+\-*/(). ]/g, ''));
        } else if (id === 'color-converter') {
            // naive hex to rgb
            if (val.startsWith('#')) {
                var hex = val.replace('#', '');
                if(hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
                var r = parseInt(hex.substring(0,2), 16);
                var g = parseInt(hex.substring(2,4), 16);
                var b = parseInt(hex.substring(4,6), 16);
                out.innerHTML = 'RGB: rgb(' + r + ', ' + g + ', ' + b + ') <div style="display:inline-block; width:20px; height:20px; background:#'+hex+'; margin-left:10px; vertical-align:middle; border:1px solid #ccc;"></div>';
            } else {
                out.textContent = 'Color converter accepts #HEX currently.';
            }
        } else {
            out.textContent = 'Calculated: ' + val;
        }
    } catch(e) {
        out.innerHTML = '<span style="color:var(--danger)">Invalid mathematical expression</span>';
    }
}

function processUnitTool(out) {
    var category = document.getElementById('gt-unit-category');
    var fromUnit = document.getElementById('gt-unit-from');
    var toUnit = document.getElementById('gt-unit-to');
    var value = document.getElementById('gt-unit-value');
    
    if (!category || !fromUnit || !toUnit || !value) {
        out.textContent = 'Error: Unit converter controls not found';
        return;
    }
    
    var cat = category.value;
    var from = fromUnit.value;
    var to = toUnit.value;
    var val = parseFloat(value.value);
    
    if (isNaN(val)) {
        out.innerHTML = '<span style="color:var(--danger)">Please enter a valid number</span>';
        return;
    }
    
    // Conversion factors to base unit
    var factors = {
        length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254, mi: 1609.344 },
        weight: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 1000 },
        volume: { l: 1, ml: 0.001, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588, floz: 0.0295735 }
    };
    
    var result;
    
    if (cat === 'temperature') {
        // Special handling for temperature
        if (from === to) {
            result = val;
        } else if (from === 'c') {
            if (to === 'f') result = (val * 9/5) + 32;
            else if (to === 'k') result = val + 273.15;
        } else if (from === 'f') {
            if (to === 'c') result = (val - 32) * 5/9;
            else if (to === 'k') result = (val - 32) * 5/9 + 273.15;
        } else if (from === 'k') {
            if (to === 'c') result = val - 273.15;
            else if (to === 'f') result = (val - 273.15) * 9/5 + 32;
        }
    } else {
        // Standard conversion using base unit
        var unitFactors = factors[cat];
        if (unitFactors && unitFactors[from] && unitFactors[to]) {
            var baseValue = val * unitFactors[from];
            result = baseValue / unitFactors[to];
        } else {
            out.innerHTML = '<span style="color:var(--danger)">Invalid unit combination</span>';
            return;
        }
    }
    
    var unitLabels = {
        length: { m: 'm', km: 'km', cm: 'cm', mm: 'mm', ft: 'ft', in: 'in', mi: 'mi' },
        weight: { kg: 'kg', g: 'g', mg: 'mg', lb: 'lb', oz: 'oz', ton: 'ton' },
        volume: { l: 'L', ml: 'mL', gal: 'gal', qt: 'qt', pt: 'pt', cup: 'cup', floz: 'fl oz' },
        temperature: { c: '°C', f: '°F', k: 'K' }
    };
    
    var fromLabel = (unitLabels[cat] && unitLabels[cat][from]) ? unitLabels[cat][from] : from;
    var toLabel = (unitLabels[cat] && unitLabels[cat][to]) ? unitLabels[cat][to] : to;
    
    out.innerHTML = '<div style="font-size:24px; font-weight:700; color:var(--accent);">' + 
        parseFloat(result.toFixed(6)) + ' ' + toLabel + '</div>' +
        '<div style="font-size:13px; color:var(--tx2); margin-top:6px;">' + 
        val + ' ' + fromLabel + ' = ' + parseFloat(result.toFixed(6)) + ' ' + toLabel + '</div>';
}

function processPercentageTool(out) {
    var mode = document.getElementById('gt-pct-mode');
    var a = document.getElementById('gt-pct-a');
    var b = document.getElementById('gt-pct-b');
    
    if (!mode || !a || !b) {
        out.textContent = 'Error: Percentage calculator controls not found';
        return;
    }
    
    var valA = parseFloat(a.value);
    var valB = parseFloat(b.value);
    
    if (isNaN(valA) || isNaN(valB)) {
        out.innerHTML = '<span style="color:var(--danger)">Please enter valid numbers</span>';
        return;
    }
    
    var result, explanation;
    
    switch (mode.value) {
        case 'what-is':
            result = (valA / 100) * valB;
            explanation = valA + '% of ' + valB + ' = ' + parseFloat(result.toFixed(4));
            break;
        case 'is-what-pct':
            if (valB === 0) {
                out.innerHTML = '<span style="color:var(--danger)">Cannot divide by zero</span>';
                return;
            }
            result = (valA / valB) * 100;
            explanation = valA + ' is ' + parseFloat(result.toFixed(2)) + '% of ' + valB;
            break;
        case 'pct-change':
            if (valA === 0) {
                out.innerHTML = '<span style="color:var(--danger)">Original value cannot be zero</span>';
                return;
            }
            result = ((valB - valA) / valA) * 100;
            var change = result >= 0 ? 'increase' : 'decrease';
            explanation = 'From ' + valA + ' to ' + valB + ': ' + parseFloat(Math.abs(result).toFixed(2)) + '% ' + change;
            break;
        default:
            explanation = 'Please select a calculation mode';
    }
    
    out.innerHTML = '<div style="font-size:20px; font-weight:700; color:var(--accent);">' + explanation + '</div>';
}

function processDateTool(out) {
    var mode = document.getElementById('gt-date-mode');
    var dateFrom = document.getElementById('gt-date-from');
    var dateTo = document.getElementById('gt-date-to');
    var dateDays = document.getElementById('gt-date-days');
    
    if (!mode || !dateFrom || !dateTo || !dateDays) {
        out.textContent = 'Error: Date calculator controls not found';
        return;
    }
    
    var result, explanation;
    
    if (mode.value === 'diff') {
        if (!dateFrom.value || !dateTo.value) {
            out.innerHTML = '<span style="color:var(--danger)">Please select both dates</span>';
            return;
        }
        var d1 = new Date(dateFrom.value);
        var d2 = new Date(dateTo.value);
        var diffMs = Math.abs(d2 - d1);
        var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        var diffWeeks = Math.floor(diffDays / 7);
        var diffMonths = Math.floor(diffDays / 30.44);
        var diffYears = Math.floor(diffDays / 365.25);
        
        explanation = '<div style="font-size:28px; font-weight:700; color:var(--accent);">' + diffDays + ' days</div>' +
            '<div style="font-size:13px; color:var(--tx2); margin-top:8px;">' +
            '≈ ' + diffWeeks + ' weeks | ' + diffMonths + ' months | ' + diffYears + ' years</div>' +
            '<div style="font-size:12px; color:var(--tx3); margin-top:4px;">' +
            dateFrom.value + ' → ' + dateTo.value + '</div>';
    } else {
        if (!dateFrom.value) {
            out.innerHTML = '<span style="color:var(--danger)">Please select a start date</span>';
            return;
        }
        var days = parseInt(dateDays.value) || 0;
        var startDate = new Date(dateFrom.value);
        var resultDate = new Date(startDate);
        resultDate.setDate(resultDate.getDate() + days);
        
        var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        var formattedResult = resultDate.toLocaleDateString('en-US', options);
        
        explanation = '<div style="font-size:20px; font-weight:700; color:var(--accent);">' + formattedResult + '</div>' +
            '<div style="font-size:13px; color:var(--tx2); margin-top:8px;">' +
            (days >= 0 ? '+' : '') + days + ' days from ' + dateFrom.value + '</div>';
    }
    
    out.innerHTML = explanation;
}

function processFileTool(id, file, out) {
    if (!file) return;
    showProcessing('Processing...', 'Working on ' + file.name);
    
    // === FILE TO PDF ===
    if (id === 'files-to-pdf') {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var ext = file.name.split('.').pop().toLowerCase();
                
                // Image to PDF
                if (file.type.startsWith('image/')) {
                    var imgData = new Uint8Array(e.target.result);
                    PDFLib.PDFDocument.create().then(function(pdfDoc) {
                        var embedPromise = file.type === 'image/png' ? pdfDoc.embedPng(imgData) : pdfDoc.embedJpg(imgData);
                        embedPromise.then(function(img) {
                            var page = pdfDoc.addPage([img.width, img.height]);
                            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                            return pdfDoc.save();
                        }).then(function(bytes) {
                            hideProcessing();
                            var blob = new Blob([bytes], { type: 'application/pdf' });
                            var url = URL.createObjectURL(blob);
                            showSuccessToast('Image converted to PDF', url, baseName(file.name) + '.pdf', out);
                        });
                    });
                }
                // DOCX to PDF (using mammoth browser-based conversion)
                else if (ext === 'docx') {
                    if (typeof mammoth === 'undefined') {
                        hideProcessing();
                        out.innerHTML = '<span style="color:red">Error: mammoth library not loaded.</span>';
                        return;
                    }
                    mammoth.convertToHtml({ arrayBuffer: e.target.result }).then(function(result) {
                        var html = result.value;
                        // Build a styled HTML page and convert to PDF via html2pdf
                        var styledHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
                            'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;margin:72px 80px;line-height:1.5;}' +
                            'h1{font-size:24pt;font-weight:bold;margin:0 0 12pt 0;}' +
                            'h2{font-size:18pt;font-weight:bold;margin:14pt 0 8pt 0;}' +
                            'h3{font-size:14pt;font-weight:bold;margin:12pt 0 6pt 0;}' +
                            'p{margin:0 0 8pt 0;}' +
                            'ul,ol{margin:0 0 8pt 0;padding-left:24pt;}' +
                            'li{margin-bottom:3pt;}' +
                            'table{border-collapse:collapse;width:100%;margin:8pt 0;}' +
                            'th{border:1px solid #bfbfbf;padding:4pt 8pt;background:#f3f3f3;font-weight:bold;}' +
                            'td{border:1px solid #bfbfbf;padding:4pt 8pt;}' +
                            '</style></head><body>' + html + '</body></html>';
                        if (typeof html2pdf !== 'undefined') {
                            var opt = {
                                margin: [72, 80],
                                filename: baseName(file.name) + '.pdf',
                                image: { type: 'jpeg', quality: 0.95 },
                                html2canvas: { scale: 2, useCORS: true },
                                jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
                            };
                            var tempDiv = document.createElement('div');
                            tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;width:595px;font-family:Calibri,Arial,sans-serif;';
                            tempDiv.innerHTML = html;
                            document.body.appendChild(tempDiv);
                            html2pdf().set(opt).from(tempDiv).outputPdf('blob').then(function(blob) {
                                document.body.removeChild(tempDiv);
                                hideProcessing();
                                var url = URL.createObjectURL(blob);
                                showSuccessToast('Word document converted to PDF', url, baseName(file.name) + '.pdf', out);
                            }).catch(function(err) {
                                document.body.removeChild(tempDiv);
                                hideProcessing();
                                out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>';
                            });
                        } else {
                            // Fallback: simple text-based PDF using textToPdfBlob
                            var plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
                            textToPdfBlob(plainText, baseName(file.name)).then(function(blob) {
                                hideProcessing();
                                var url = URL.createObjectURL(blob);
                                showSuccessToast('Word document converted to PDF (teks saja)', url, baseName(file.name) + '.pdf', out);
                            });
                        }
                    }).catch(function(err) {
                        hideProcessing();
                        out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>';
                    });
                }
                // XLSX/CSV to PDF
                else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
                    var data = new Uint8Array(e.target.result);
                    var wb = XLSX.read(data, { type: 'array' });
                    var text = '';
                    wb.SheetNames.forEach(function(name) {
                        text += '=== ' + name + ' ===\n';
                        text += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n\n';
                    });
                    textToPdfBlob(text, baseName(file.name)).then(function(blob) {
                        hideProcessing();
                        var url = URL.createObjectURL(blob);
                        showSuccessToast('Spreadsheet converted to PDF', url, baseName(file.name) + '.pdf', out);
                    });
                }
                // PPTX to PDF
                else if (ext === 'pptx') {
                    JSZip.loadAsync(e.target.result).then(function(zip) {
                        var text = '';
                        var slideFiles = [];
                        zip.forEach(function(path, entry) {
                            var m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
                            if (m) slideFiles.push({ num: parseInt(m[1]), entry: entry });
                        });
                        slideFiles.sort(function(a, b) { return a.num - b.num; });
                        var promises = slideFiles.map(function(slide) {
                            return slide.entry.async('text').then(function(xml) {
                                var matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
                                var slideText = matches.map(function(t) {
                                    return t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                                }).filter(function(s) { return s.trim(); }).join('\n');
                                text += '=== Slide ' + slide.num + ' ===\n' + slideText + '\n\n';
                            });
                        });
                        return Promise.all(promises).then(function() { return text; });
                    }).then(function(text) {
                        textToPdfBlob(text, baseName(file.name)).then(function(blob) {
                            hideProcessing();
                            var url = URL.createObjectURL(blob);
                            showSuccessToast('Presentation converted to PDF', url, baseName(file.name) + '.pdf', out);
                        });
                    }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
                }
                // Text/Markdown to PDF
                else {
                    var text = new TextDecoder().decode(e.target.result);
                    if (ext === 'md') {
                        text = marked.parse(text);
                        text = text.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
                    }
                    textToPdfBlob(text, baseName(file.name)).then(function(blob) {
                        hideProcessing();
                        var url = URL.createObjectURL(blob);
                        showSuccessToast('Text converted to PDF', url, baseName(file.name) + '.pdf', out);
                    });
                }
            } catch(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; }
        };
        reader.readAsArrayBuffer(file);
        return;
    }
    
    // === PDF TO WORD ===
    if (id === 'pdf-to-word') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        extractPdfStructured(file).then(function(structured) {
            // Check if PDF has meaningful text content
            var totalChars = structured.reduce(function(s, pg) { return s + pg.reduce(function(s2, l) { return s2 + l.text.length; }, 0); }, 0);
            if (totalChars < 30) {
                // Image-based PDF: fall back to page images embedded in DOCX
                return extractPdfPagesRich(file, 2).then(function(rp) { return buildDocxFromPagesImage(rp); });
            }
            return buildDocxFromStructured(structured);
        }).then(function(blob) {
            hideProcessing();
            var url = URL.createObjectURL(blob);
            out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px; margin-bottom:10px;"><b>Success!</b> PDF converted to Word.</div><a href="' + url + '" download="' + baseName(file.name) + '.docx" class="gt-btn" style="display:inline-flex; align-items:center; gap:6px; margin-top:4px; text-decoration:none;"><i class="ph ph-download-simple"></i> Download DOCX</a>';
        }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        return;
    }
    
    // === PDF TO IMAGES ===
    if (id === 'pdf-to-images') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        var scaleInput = document.getElementById('pdf-img-scale');
        var imgScale = scaleInput ? parseFloat(scaleInput.value) || 2 : 2;
        renderPdfPagesToCanvas(file, imgScale).then(function(canvases) {
            if (canvases.length === 1) {
                canvases[0].toBlob(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Converted at ' + imgScale + 'x resolution (' + canvases[0].width + ' × ' + canvases[0].height + 'px)</div><a href="' + url + '" download="' + baseName(file.name) + '.png" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download PNG</a>';
                });
            } else {
                var zip = new JSZip();
                var promises = canvases.map(function(c, i) {
                    return new Promise(function(resolve) {
                        c.toBlob(function(blob) {
                            zip.file('page_' + (i + 1) + '.png', blob);
                            resolve();
                        });
                    });
                });
                Promise.all(promises).then(function() {
                    return zip.generateAsync({ type: 'blob' });
                }).then(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> ' + canvases.length + ' pages at ' + imgScale + 'x resolution (' + canvases[0].width + ' × ' + canvases[0].height + 'px each)</div><a href="' + url + '" download="' + baseName(file.name) + '_images.zip" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download ZIP</a>';
                });
            }
        }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        return;
    }
    
    // === PDF TO TEXT ===
    if (id === 'pdf-to-text') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        extractPdfText(file).then(function(pages) {
            hideProcessing();
            var text = pages.map(function(p, i) { return '=== Page ' + (i + 1) + ' ===\n' + p; }).join('\n\n');
            var blob = new Blob([text], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);
            out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Text extracted from ' + pages.length + ' pages</div><textarea style="width:100%; height:200px; padding:12px; margin-top:10px; font-family:monospace;">' + text.substring(0, 2000) + (text.length > 2000 ? '...' : '') + '</textarea><br/><a href="' + url + '" download="' + baseName(file.name) + '.txt" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download Full Text</a>';
        }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        return;
    }
    
    // === SPLIT PDF ===
    if (id === 'split-pdf') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            PDFLib.PDFDocument.load(e.target.result).then(function(pdfDoc) {
                var pageCount = pdfDoc.getPageCount();
                var zip = new JSZip();
                var promises = [];
                for (var i = 0; i < pageCount; i++) {
                    (function(idx) {
                        promises.push(PDFLib.PDFDocument.create().then(function(newDoc) {
                            return newDoc.copyPages(pdfDoc, [idx]).then(function(pages) {
                                newDoc.addPage(pages[0]);
                                return newDoc.save();
                            }).then(function(bytes) {
                                zip.file('page_' + (idx + 1) + '.pdf', bytes);
                            });
                        }));
                    })(i);
                }
                Promise.all(promises).then(function() {
                    return zip.generateAsync({ type: 'blob' });
                }).then(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> PDF split into ' + pageCount + ' pages</div><a href="' + url + '" download="' + baseName(file.name) + '_split.zip" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download ZIP</a>';
                });
            }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        };
        reader.readAsArrayBuffer(file);
        return;
    }

    // === DELETE PAGES ===
    if (id === 'delete-pages') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        var pagesInput = document.getElementById('gt-delete-pages-input');
        var pagesStr = pagesInput ? pagesInput.value.trim() : '';
        if (!pagesStr) { hideProcessing(); out.innerHTML = '<span style="color:red">Please enter page numbers to delete.</span>'; return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            PDFLib.PDFDocument.load(e.target.result).then(function(pdfDoc) {
                var total = pdfDoc.getPageCount();
                var toDelete = parsePageRanges(pagesStr, total);
                if (toDelete.length === 0) { hideProcessing(); out.innerHTML = '<span style="color:red">No valid pages specified.</span>'; return; }
                if (toDelete.length >= total) { hideProcessing(); out.innerHTML = '<span style="color:red">Cannot delete all pages.</span>'; return; }
                // Remove in reverse order so indices stay valid
                toDelete.sort(function(a, b) { return b - a; });
                toDelete.forEach(function(idx) { pdfDoc.removePage(idx); });
                return pdfDoc.save();
            }).then(function(bytes) {
                hideProcessing();
                var blob = new Blob([bytes], { type: 'application/pdf' });
                var url = URL.createObjectURL(blob);
                out.innerHTML = '<div class="gt-result gt-result-success"><div class="gt-result-title"><i class="ph ph-check-circle"></i> Done! Pages deleted successfully.</div></div><a href="' + url + '" download="deleted_' + file.name + '" class="gt-btn" style="display:inline-flex;margin-top:12px;"><i class="ph ph-download-simple"></i> Download PDF</a>';
            }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        };
        reader.readAsArrayBuffer(file);
        return;
    }

    // === EXTRACT PAGES ===
    if (id === 'extract-pages') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        var pagesInputE = document.getElementById('gt-extract-pages-input');
        var pagesStrE = pagesInputE ? pagesInputE.value.trim() : '';
        if (!pagesStrE) { hideProcessing(); out.innerHTML = '<span style="color:red">Please enter page numbers to extract.</span>'; return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            PDFLib.PDFDocument.load(e.target.result).then(function(pdfDoc) {
                var total = pdfDoc.getPageCount();
                var toExtract = parsePageRanges(pagesStrE, total);
                if (toExtract.length === 0) { hideProcessing(); out.innerHTML = '<span style="color:red">No valid pages specified.</span>'; return; }
                return PDFLib.PDFDocument.create().then(function(newDoc) {
                    return newDoc.copyPages(pdfDoc, toExtract).then(function(pages) {
                        pages.forEach(function(p) { newDoc.addPage(p); });
                        return newDoc.save();
                    });
                });
            }).then(function(bytes) {
                hideProcessing();
                var blob = new Blob([bytes], { type: 'application/pdf' });
                var url = URL.createObjectURL(blob);
                out.innerHTML = '<div class="gt-result gt-result-success"><div class="gt-result-title"><i class="ph ph-check-circle"></i> Done! Pages extracted successfully.</div></div><a href="' + url + '" download="extracted_' + file.name + '" class="gt-btn" style="display:inline-flex;margin-top:12px;"><i class="ph ph-download-simple"></i> Download PDF</a>';
            }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        };
        reader.readAsArrayBuffer(file);
        return;
    }

    // === ROTATE PDF ===
    if (id === 'rotate-pdf') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        // Use whatever rotation the user has set via preview buttons; default to 90 if none chosen
        var angle = (window._currentPreviewRotation && window._currentPreviewRotation !== 0)
            ? window._currentPreviewRotation
            : 90;
        var reader = new FileReader();
        reader.onload = function(e) {
            var arrayBuffer = e.target.result;
            // Process the PDF
            PDFLib.PDFDocument.load(arrayBuffer).then(function(pdfDoc) {
                pdfDoc.getPages().forEach(function(page) {
                    var rot = page.getRotation().angle;
                    page.setRotation(PDFLib.degrees((rot + angle) % 360));
                });
                return pdfDoc.save();
            }).then(function(bytes) {
                hideProcessing();
                var blob = new Blob([bytes], { type: 'application/pdf' });
                var url = URL.createObjectURL(blob);
                // Show preview of rotated PDF
                var rotatedFile = new File([blob], 'rotated_' + file.name, { type: 'application/pdf' });
                var reader2 = new FileReader();
                reader2.onload = function(e2) {
                    ensurePdfJs();
                    pdfjsLib.getDocument({ data: e2.target.result.slice(0) }).promise.then(function(pdf) {
                        pdf.getPage(1).then(function(page) {
                            var viewport = page.getViewport({ scale: 1.2 });
                            var canvas = document.createElement('canvas');
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            var ctx = canvas.getContext('2d');
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
                                canvas.style.maxWidth = '100%';
                                canvas.style.height = 'auto';
                                canvas.style.borderRadius = 'var(--radius-sm)';
                                canvas.style.border = '1px solid var(--border-color)';
                                canvas.style.boxShadow = 'var(--shadow-sm)';
                                out.innerHTML = '<div class="gt-result gt-result-success"><div class="gt-result-title"><i class="ph ph-check-circle"></i> Success! PDF rotated ' + angle + '°</div><div class="gt-result-text">Preview of rotated PDF:</div></div>' +
                                    '<div style="text-align:center; margin-top:16px;">' + canvas.outerHTML + '</div>' +
                                    '<a href="' + url + '" download="rotated_' + file.name + '" class="gt-btn" style="display:inline-flex; margin-top:16px;"><i class="ph ph-download-simple"></i> Download Rotated PDF</a>';
                            });
                        });
                    });
                };
                reader2.readAsArrayBuffer(blob);
            }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        };
        reader.readAsArrayBuffer(file);
        return;
    }
    
    // === PROTECT PDF (add password) ===
    if (id === 'protect-pdf') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        var pwdInput = document.getElementById('gt-protect-password');
        var userPwd = pwdInput ? pwdInput.value : '';
        if (!userPwd) { hideProcessing(); out.innerHTML = '<span style="color:red">Please enter a password.</span>'; return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var fs = require('fs');
                var path = require('path');
                var { exec } = require('child_process');
                var os = require('os');
                var tmpDir = os.tmpdir();
                var inputPath = path.join(tmpDir, 'input_protect_' + Date.now() + '.pdf');
                var outputPath = path.join(tmpDir, 'protected_' + Date.now() + '.pdf');
                var scriptPath = path.join(path.dirname(process.execPath), 'protect_pdf.py');
                // Write uploaded PDF to temp file
                var buf = Buffer.from(e.target.result);
                fs.writeFileSync(inputPath, buf);
                // Escape password for shell (wrap in quotes, escape quotes inside)
                var safePwd = userPwd.replace(/"/g, '\\"');
                var cmd = 'python "' + scriptPath + '" "' + inputPath + '" "' + outputPath + '" "' + safePwd + '"';
                exec(cmd, { timeout: 30000 }, function(error, stdout, stderr) {
                    try { fs.unlinkSync(inputPath); } catch(e) {}
                    // Filter out pip warnings from stderr (not real errors)
                    var realErr = (stderr || '').split('\n').filter(function(l) {
                        return l && !l.match(/WARNING|pip|DeprecationWarning|CryptographyDeprecation/i);
                    }).join('\n').trim();
                    if (error && realErr) {
                        hideProcessing();
                        out.innerHTML = '<span style="color:red">Error: ' + realErr + '</span>';
                        return;
                    }
                    try {
                        var outBuf = fs.readFileSync(outputPath);
                        try { fs.unlinkSync(outputPath); } catch(e) {}
                        var blob = new Blob([outBuf.buffer.slice(outBuf.byteOffset, outBuf.byteOffset + outBuf.byteLength)], { type: 'application/pdf' });
                        var url = URL.createObjectURL(blob);
                        hideProcessing();
                        out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px; margin-bottom:10px;"><b>Success!</b> PDF is now password protected (AES-128).</div><a href="' + url + '" download="protected_' + file.name + '" class="gt-btn" style="display:inline-block; text-decoration:none;">Download Protected PDF</a>';
                    } catch(readErr) {
                        hideProcessing();
                        out.innerHTML = '<span style="color:red">Error reading output: ' + readErr.message + '</span>';
                    }
                });
            } catch(err) {
                hideProcessing();
                out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>';
            }
        };
        reader.readAsArrayBuffer(file);
        return;
    }
    
    // === UNLOCK PDF ===
    if (id === 'unlock-pdf') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        var pwdInput = document.getElementById('gt-unlock-password');
        var password = pwdInput ? pwdInput.value : '';
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var fs = require('fs');
                var path = require('path');
                var { exec } = require('child_process');
                var os = require('os');
                var tmpDir = os.tmpdir();
                var inputPath = path.join(tmpDir, 'input_unlock_' + Date.now() + '.pdf');
                var outputPath = path.join(tmpDir, 'unlocked_' + Date.now() + '.pdf');
                var scriptPath = path.join(path.dirname(process.execPath), 'unlock_pdf.py');
                var buf = Buffer.from(e.target.result);
                fs.writeFileSync(inputPath, buf);
                var safePwd = (password || '').replace(/"/g, '\\"');
                var cmd = 'python "' + scriptPath + '" "' + inputPath + '" "' + outputPath + '" "' + safePwd + '"';
                exec(cmd, { timeout: 30000 }, function(error, stdout, stderr) {
                    try { fs.unlinkSync(inputPath); } catch(e) {}
                    var realErr = (stderr || '').split('\n').filter(function(l) {
                        return l && !l.match(/WARNING|pip|DeprecationWarning|CryptographyDeprecation/i);
                    }).join('\n').trim();
                    if (error && realErr) {
                        hideProcessing();
                        var msg = realErr.indexOf('Wrong password') !== -1 ? 'Wrong password. Please try again.' : realErr;
                        out.innerHTML = '<span style="color:red">Error: ' + msg + '</span>';
                        return;
                    }
                    try {
                        var outBuf = fs.readFileSync(outputPath);
                        try { fs.unlinkSync(outputPath); } catch(e) {}
                        var blob = new Blob([outBuf.buffer.slice(outBuf.byteOffset, outBuf.byteOffset + outBuf.byteLength)], { type: 'application/pdf' });
                        var url = URL.createObjectURL(blob);
                        hideProcessing();
                        out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px; margin-bottom:10px;"><b>Success!</b> PDF password removed.</div><a href="' + url + '" download="unlocked_' + file.name + '" class="gt-btn" style="display:inline-block; text-decoration:none;">Download Unlocked PDF</a>';
                    } catch(readErr) {
                        hideProcessing();
                        out.innerHTML = '<span style="color:red">Error reading output: ' + readErr.message + '</span>';
                    }
                });
            } catch(err) {
                hideProcessing();
                out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>';
            }
        };
        reader.readAsArrayBuffer(file);
        return;
    }
    
    // === RESIZE IMAGE ===
    if (id === 'resize-image') {
        if (!file.type.startsWith('image/')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload an image file.</span>'; return; }
        var widthInput = document.getElementById('gt-resize-value');
        var resizeValue = widthInput ? parseInt(widthInput.value) || 800 : 800;
        // Check which mode is selected: By Width or By Percentage
        var modeRadio = document.querySelector('input[name="gt-resize-mode"]:checked');
        var resizeMode = modeRadio ? modeRadio.value : 'width';
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                if (resizeMode === 'percentage') {
                    var factor = resizeValue / 100;
                    canvas.width = Math.round(img.width * factor);
                    canvas.height = Math.round(img.height * factor);
                } else {
                    var ratio = resizeValue / img.width;
                    canvas.width = resizeValue;
                    canvas.height = Math.round(img.height * ratio);
                }
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Image resized to ' + canvas.width + 'x' + canvas.height + '</div><a href="' + url + '" download="resized_' + file.name + '" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download Image</a>';
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // === COMPRESS IMAGE ===
    if (id === 'compress-image') {
        if (!file.type.startsWith('image/')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload an image file.</span>'; return; }
        var qualityInput = document.getElementById('gt-compress-quality');
        var quality = qualityInput ? parseInt(qualityInput.value) / 100 : 0.6;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    var reduction = Math.round((1 - blob.size / file.size) * 100);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Compressed by ' + reduction + '% (Original: ' + formatFileSize(file.size) + ' → Compressed: ' + formatFileSize(blob.size) + ')</div><a href="' + url + '" download="compressed_' + file.name.replace(/\.[^.]+$/, '.jpg') + '" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download Image</a>';
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // === CONVERT FORMAT ===
    if (id === 'convert-format') {
        if (!file.type.startsWith('image/')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload an image file.</span>'; return; }
        var formatInput = document.getElementById('gt-convert-format');
        var format = formatInput ? (formatInput.value || 'jpg').toLowerCase() : 'jpg';
        var mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        var mime = mimeMap[format] || 'image/jpeg';
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Converted to ' + format.toUpperCase() + '</div><a href="' + url + '" download="' + baseName(file.name) + '.' + format + '" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download Image</a>';
                }, mime, 0.92);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // === CROP IMAGE ===
    if (id === 'crop-image') {
        if (!file.type.startsWith('image/')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload an image file.</span>'; return; }
        var x = parseInt(document.getElementById('gt-crop-x').value) || 0;
        var y = parseInt(document.getElementById('gt-crop-y').value) || 0;
        var w = parseInt(document.getElementById('gt-crop-w').value) || 200;
        var h = parseInt(document.getElementById('gt-crop-h').value) || 200;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
                canvas.toBlob(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Image cropped to ' + w + 'x' + h + '</div><a href="' + url + '" download="cropped_' + file.name + '" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download Image</a>';
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // === ROTATE/FLIP IMAGE ===
    if (id === 'rotate-flip') {
        if (!file.type.startsWith('image/')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload an image file.</span>'; return; }
        var actionInput = document.getElementById('gt-flip-action');
        var action = actionInput ? (actionInput.value || 'rotate90') : 'rotate90';
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var isRotation = action.startsWith('rotate');
                if (isRotation && (action === 'rotate90' || action === 'rotate270')) {
                    canvas.width = img.height;
                    canvas.height = img.width;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
                ctx.save();
                if (action === 'rotate90') { ctx.translate(canvas.width, 0); ctx.rotate(Math.PI / 2); }
                else if (action === 'rotate180') { ctx.translate(canvas.width, canvas.height); ctx.rotate(Math.PI); }
                else if (action === 'rotate270') { ctx.translate(0, canvas.height); ctx.rotate(-Math.PI / 2); }
                else if (action === 'flipH') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
                else if (action === 'flipV') { ctx.translate(0, canvas.height); ctx.scale(1, -1); }
                ctx.drawImage(img, 0, 0);
                ctx.restore();
                canvas.toBlob(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Image ' + action + '</div><a href="' + url + '" download="' + action + '_' + file.name + '" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download Image</a>';
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // === ADD WATERMARK IMAGE ===
    if (id === 'add-watermark-image') {
        if (!file.type.startsWith('image/')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload an image file.</span>'; return; }
        var wmTextInput = document.getElementById('gt-watermark-text');
        var watermarkText = wmTextInput ? (wmTextInput.value || 'CONFIDENTIAL') : 'CONFIDENTIAL';
        var opacityInput = document.getElementById('watermark-opacity');
        var watermarkOpacity = opacityInput ? (parseInt(opacityInput.value) / 100) : 0.3;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                ctx.save();
                ctx.globalAlpha = watermarkOpacity;
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold ' + Math.max(40, img.width / 10) + 'px Arial';
                ctx.textAlign = 'center';
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(-Math.PI / 6);
                ctx.fillText(watermarkText, 0, 0);
                ctx.restore();
                canvas.toBlob(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Watermark added</div><a href="' + url + '" download="watermarked_' + file.name + '" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download Image</a>';
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // === REMOVE BACKGROUND (Canvas-based color segmentation) ===
    if (id === 'remove-background') {
        if (!file.type.startsWith('image/')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload an image file.</span>'; return; }
        
        var statusDiv = document.createElement('div');
        statusDiv.style.cssText = 'padding:16px; background:#dbeafe; color:#1e40af; border-radius:8px; margin-bottom:12px;';
        statusDiv.innerHTML = '<b>Processing...</b> Removing background using color segmentation.';
        out.innerHTML = '';
        out.appendChild(statusDiv);
        
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                setTimeout(function() {
                    var canvas = document.createElement('canvas');
                    var ctx = canvas.getContext('2d', { willReadFrequently: true });
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    var data = imageData.data;
                    var w = canvas.width;
                    var h = canvas.height;
                    
                    // Sample background color from corners
                    var sampleSize = Math.min(20, Math.floor(w / 10));
                    var bgR = 0, bgG = 0, bgB = 0, count = 0;
                    for (var y = 0; y < sampleSize; y++) {
                        for (var x = 0; x < sampleSize; x++) {
                            var i = (y * w + x) * 4;
                            bgR += data[i]; bgG += data[i+1]; bgB += data[i+2]; count++;
                            i = (y * w + (w - 1 - x)) * 4;
                            bgR += data[i]; bgG += data[i+1]; bgB += data[i+2]; count++;
                            i = ((h - 1 - y) * w + x) * 4;
                            bgR += data[i]; bgG += data[i+1]; bgB += data[i+2]; count++;
                            i = ((h - 1 - y) * w + (w - 1 - x)) * 4;
                            bgR += data[i]; bgG += data[i+1]; bgB += data[i+2]; count++;
                        }
                    }
                    bgR = Math.round(bgR / count);
                    bgG = Math.round(bgG / count);
                    bgB = Math.round(bgB / count);
                    
                    // Calculate color variance for threshold
                    var threshold = 60;
                    
                    // Apply alpha based on color distance from background
                    for (var i = 0; i < data.length; i += 4) {
                        var r = data[i], g = data[i+1], b = data[i+2];
                        var dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
                        if (dist < threshold) {
                            data[i+3] = 0;
                        } else if (dist < threshold * 1.5) {
                            data[i+3] = Math.round(255 * (dist - threshold) / (threshold * 0.5));
                        }
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    
                    canvas.toBlob(function(blob) {
                        hideProcessing();
                        var url = URL.createObjectURL(blob);
                        var origSize = formatFileSize(file.size);
                        var newSize = formatFileSize(blob.size);
                        out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Background removed (Original: ' + origSize + ' → Result: ' + newSize + ')</div>' +
                            '<img src="' + url + '" style="max-width:100%; max-height:400px; border-radius:8px; margin-top:12px; background: repeating-conic-gradient(#f0f0f0 0% 25%, transparent 0% 50%) 50% / 20px 20px;" />' +
                            '<a href="' + url + '" download="no_bg_' + baseName(file.name) + '.png" class="gt-btn" style="display:inline-block; margin-top:12px; text-decoration:none;">Download PNG</a>';
                    }, 'image/png');
                }, 100);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // === RESIZE PDF ===
    if (id === 'resize-pdf') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        var pageSizeInput = document.getElementById('gt-pdf-size');
        var pageSize = pageSizeInput ? (pageSizeInput.value || 'A4').toUpperCase() : 'A4';
        if (pageSize === null) { hideProcessing(); return; }
        var sizes = { A4: [595.28, 841.89], A3: [841.89, 1190.55], Letter: [612, 792], Legal: [612, 1008] };
        var size = sizes[pageSize.toUpperCase()] || sizes['A4'];
        var reader = new FileReader();
        reader.onload = function(e) {
            PDFLib.PDFDocument.load(e.target.result).then(function(pdfDoc) {
                // Must await PDFDocument.create() — it returns a Promise
                return PDFLib.PDFDocument.create().then(function(newPdf) {
                    var pageCount = pdfDoc.getPageCount();
                    var indices = [];
                    for (var i = 0; i < pageCount; i++) indices.push(i);
                    return newPdf.copyPages(pdfDoc, indices).then(function(copiedPages) {
                        copiedPages.forEach(function(copiedPage) {
                            // Scale the copied page to new dimensions using setSize
                            copiedPage.setSize(size[0], size[1]);
                            newPdf.addPage(copiedPage);
                        });
                        return newPdf.save();
                    });
                });
            }).then(function(bytes) {
                hideProcessing();
                var blob = new Blob([bytes], { type: 'application/pdf' });
                var url = URL.createObjectURL(blob);
                out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> PDF diubah ke ukuran ' + pageSize.toUpperCase() + '</div><a href="' + url + '" download="resized_' + file.name + '" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download PDF</a>';
            }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        };
        reader.readAsArrayBuffer(file);
        return;
    }
    
    // === PAGE NUMBERS ===
    if (id === 'page-numbers') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            PDFLib.PDFDocument.load(e.target.result).then(function(pdfDoc) {
                var helveticaFont = pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
                var pages = pdfDoc.getPages();
                var posInput = document.getElementById('num-position');
                var numPos = posInput ? (posInput.value || 'bottom-center') : 'bottom-center';
                var fontPromise = helveticaFont;
                return fontPromise.then(function(font) {
                    pages.forEach(function(page, idx) {
                        var pageSize = page.getSize();
                        var numText = String(idx + 1);
                        var textW = numText.length * 7;
                        var x, y;
                        if (numPos === 'bottom-right') {
                            x = pageSize.width - textW - 30;
                            y = 30;
                        } else if (numPos === 'top-center') {
                            x = pageSize.width / 2 - textW / 2;
                            y = pageSize.height - 30;
                        } else {
                            // bottom-center (default)
                            x = pageSize.width / 2 - textW / 2;
                            y = 30;
                        }
                        page.drawText(numText, {
                            x: x,
                            y: y,
                            size: 12,
                            font: font,
                            color: PDFLib.rgb(0, 0, 0)
                        });
                    });
                    return pdfDoc.save();
                });
            }).then(function(bytes) {
                hideProcessing();
                var blob = new Blob([bytes], { type: 'application/pdf' });
                var url = URL.createObjectURL(blob);
                out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Page numbers added</div><a href="' + url + '" download="numbered_' + file.name + '" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download PDF</a>';
            }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        };
        reader.readAsArrayBuffer(file);
        return;
    }
    
    // === EXTRACT IMAGES FROM PDF ===
    if (id === 'extract-images') {
        if (!file.name.toLowerCase().endsWith('.pdf')) { hideProcessing(); out.innerHTML = '<span style="color:red">Please upload a PDF file.</span>'; return; }
        renderPdfPagesToCanvas(file, 2).then(function(canvases) {
            if (canvases.length === 1) {
                canvases[0].toBlob(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> Image extracted from PDF</div><a href="' + url + '" download="' + baseName(file.name) + '_image.png" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download PNG</a>';
                });
            } else {
                var zip = new JSZip();
                var promises = canvases.map(function(c, i) {
                    return new Promise(function(resolve) {
                        c.toBlob(function(blob) {
                            zip.file('page_' + (i + 1) + '.png', blob);
                            resolve();
                        });
                    });
                });
                Promise.all(promises).then(function() {
                    return zip.generateAsync({ type: 'blob' });
                }).then(function(blob) {
                    hideProcessing();
                    var url = URL.createObjectURL(blob);
                    out.innerHTML = '<div style="padding:16px; background:#dcfce7; color:#166534; border-radius:8px;"><b>Success!</b> ' + canvases.length + ' images extracted</div><a href="' + url + '" download="' + baseName(file.name) + '_images.zip" class="gt-btn" style="display:inline-block; margin-top:10px; text-decoration:none;">Download ZIP</a>';
                });
            }
        }).catch(function(err) { hideProcessing(); out.innerHTML = '<span style="color:red">Error: ' + err.message + '</span>'; });
        return;
    }
    
    // Default: show not implemented message
    hideProcessing();
    out.innerHTML = '<div style="padding:16px; background:#fee2e2; color:#991b1b; border-radius:8px;"><b>Coming Soon:</b> This feature is under development.</div>';
}

// ==========================================
// QR CODE GENERATOR - Complete Standards-Compliant Implementation
// Based on qrcode-generator by Kazuhiko Arase (MIT License)
// ==========================================
var QRCodeGenerator = (function() {
    var PAD0 = 0xEC, PAD1 = 0x11;
    var EXP_TABLE = new Array(256), LOG_TABLE = new Array(256);
    for (var i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
    for (var i = 8; i < 256; i++) EXP_TABLE[i] = EXP_TABLE[i-4] ^ EXP_TABLE[i-5] ^ EXP_TABLE[i-6] ^ EXP_TABLE[i-8];
    for (var i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

    function glog(n) { if (n < 1) throw new Error('log'); return LOG_TABLE[n]; }
    function gexp(n) { while (n < 0) n += 255; while (n >= 256) n -= 255; return EXP_TABLE[n]; }

    function Polynomial(num, shift) {
        var off = 0;
        while (off < num.length && num[off] === 0) off++;
        this.num = new Array(num.length - off + (shift || 0));
        for (var i = 0; i < num.length - off; i++) this.num[i] = num[i + off];
    }
    Polynomial.prototype.get = function(i) { return this.num[i]; };
    Polynomial.prototype.getLength = function() { return this.num.length; };
    Polynomial.prototype.multiply = function(e) {
        var num = new Array(this.getLength() + e.getLength() - 1);
        for (var i = 0; i < this.getLength(); i++)
            for (var j = 0; j < e.getLength(); j++)
                num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
        return new Polynomial(num, 0);
    };
    Polynomial.prototype.mod = function(e) {
        if (this.getLength() - e.getLength() < 0) return this;
        var ratio = glog(this.get(0)) - glog(e.get(0));
        var num = new Array(this.getLength());
        for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
        for (var i = 0; i < e.getLength(); i++) num[i] ^= gexp(glog(e.get(i)) + ratio);
        return new Polynomial(num, 0).mod(e);
    };

    var RS_BLOCK_TABLE = [
        [1,26,19],[1,26,16],[1,26,13],[1,26,9],
        [1,44,34],[1,44,28],[1,44,22],[1,44,16],
        [1,70,55],[1,70,44],[2,35,17],[2,35,13],
        [1,100,80],[2,50,32],[2,50,24],[4,25,9],
        [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
        [2,86,68],[4,43,27],[4,43,19],[4,43,15],
        [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
        [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
        [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13]
    ];

    function RSBlock(totalCount, dataCount) { this.totalCount = totalCount; this.dataCount = dataCount; }
    RSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
        var rsBlock = RSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
        var length = rsBlock.length / 3, list = [];
        for (var i = 0; i < length; i++) {
            var count = rsBlock[i*3+0], totalCount = rsBlock[i*3+1], dataCount = rsBlock[i*3+2];
            for (var j = 0; j < count; j++) list.push(new RSBlock(totalCount, dataCount));
        }
        return list;
    };
    RSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {
        switch(errorCorrectLevel) {
            case 1: return RS_BLOCK_TABLE[(typeNumber-1)*4+0];
            case 0: return RS_BLOCK_TABLE[(typeNumber-1)*4+1];
            case 3: return RS_BLOCK_TABLE[(typeNumber-1)*4+2];
            case 2: return RS_BLOCK_TABLE[(typeNumber-1)*4+3];
        }
        throw new Error('bad ecl');
    };

    function BitBuffer() { this.buffer = []; this.length = 0; }
    BitBuffer.prototype.get = function(i) { return ((this.buffer[i>>3] >>> (7-(i&7))) & 1) === 1; };
    BitBuffer.prototype.put = function(num, length) { for (var i = 0; i < length; i++) this.putBit(((num >>> (length-i-1)) & 1) === 1); };
    BitBuffer.prototype.getLengthInBits = function() { return this.length; };
    BitBuffer.prototype.putBit = function(bit) {
        var index = this.length >> 3;
        if (this.buffer.length <= index) this.buffer.push(0);
        if (bit) this.buffer[index] |= (0x80 >>> (this.length & 7));
        this.length++;
    };

    var PATTERN_POSITION_TABLE = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];

    function QRCode(typeNumber, errorCorrectLevel) {
        this.typeNumber = typeNumber;
        this.errorCorrectLevel = errorCorrectLevel;
        this.modules = null;
        this.moduleCount = 0;
        this.dataCache = null;
        this.dataList = [];
    }
    QRCode.prototype.addData = function(data) { this.dataList.push(new QR8bitByte(data)); this.dataCache = null; };
    QRCode.prototype.make = function() { this.makeImpl(false, this.getBestMaskPattern()); };
    QRCode.prototype.makeImpl = function(test, maskPattern) {
        this.moduleCount = this.typeNumber * 4 + 17;
        this.modules = new Array(this.moduleCount);
        for (var row = 0; row < this.moduleCount; row++) {
            this.modules[row] = new Array(this.moduleCount);
            for (var col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
        }
        this.setupPositionProbePattern(0, 0);
        this.setupPositionProbePattern(this.moduleCount - 7, 0);
        this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupPositionAdjustPattern();
        this.setupTimingPattern();
        this.setupTypeInfo(test, maskPattern);
        if (this.typeNumber >= 7) this.setupTypeNumber(test);
        if (this.dataCache === null) this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
        this.mapData(this.dataCache, maskPattern);
    };
    QRCode.prototype.setupPositionProbePattern = function(row, col) {
        for (var r = -1; r <= 7; r++) {
            if (row + r <= -1 || this.moduleCount <= row + r) continue;
            for (var c = -1; c <= 7; c++) {
                if (col + c <= -1 || this.moduleCount <= col + c) continue;
                if ((0 <= r && r <= 6 && (c === 0 || c === 6)) || (0 <= c && c <= 6 && (r === 0 || r === 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                    this.modules[row + r][col + c] = true;
                } else {
                    this.modules[row + r][col + c] = false;
                }
            }
        }
    };
    QRCode.prototype.getBestMaskPattern = function() {
        var minLostPoint = 0, pattern = 0;
        for (var i = 0; i < 8; i++) {
            this.makeImpl(true, i);
            var lostPoint = QRUtil.getLostPoint(this);
            if (i === 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; }
        }
        return pattern;
    };
    QRCode.prototype.setupTimingPattern = function() {
        for (var r = 8; r < this.moduleCount - 8; r++) { if (this.modules[r][6] !== null) continue; this.modules[r][6] = (r % 2 === 0); }
        for (var c = 8; c < this.moduleCount - 8; c++) { if (this.modules[6][c] !== null) continue; this.modules[6][c] = (c % 2 === 0); }
    };
    QRCode.prototype.setupPositionAdjustPattern = function() {
        var pos = PATTERN_POSITION_TABLE[this.typeNumber - 1];
        for (var i = 0; i < pos.length; i++) {
            for (var j = 0; j < pos.length; j++) {
                var row = pos[i], col = pos[j];
                if (this.modules[row][col] !== null) continue;
                for (var r = -2; r <= 2; r++) {
                    for (var c = -2; c <= 2; c++) {
                        if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                            this.modules[row + r][col + c] = true;
                        } else {
                            this.modules[row + r][col + c] = false;
                        }
                    }
                }
            }
        }
    };
    QRCode.prototype.setupTypeNumber = function(test) {
        var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        for (var i = 0; i < 18; i++) {
            var mod = (!test && ((bits >> i) & 1) === 1);
            this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        }
        for (var i = 0; i < 18; i++) {
            var mod = (!test && ((bits >> i) & 1) === 1);
            this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
    };
    QRCode.prototype.setupTypeInfo = function(test, maskPattern) {
        var data = (this.errorCorrectLevel << 3) | maskPattern;
        var bits = QRUtil.getBCHTypeInfo(data);
        for (var i = 0; i < 15; i++) {
            var mod = (!test && ((bits >> i) & 1) === 1);
            if (i < 6) this.modules[i][8] = mod;
            else if (i < 8) this.modules[i + 1][8] = mod;
            else this.modules[this.moduleCount - 15 + i][8] = mod;
        }
        for (var i = 0; i < 15; i++) {
            var mod = (!test && ((bits >> i) & 1) === 1);
            if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
            else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
            else this.modules[8][15 - i - 1] = mod;
        }
        this.modules[this.moduleCount - 8][8] = (!test);
    };
    QRCode.prototype.mapData = function(data, maskPattern) {
        var inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;
        for (var col = this.moduleCount - 1; col > 0; col -= 2) {
            if (col === 6) col--;
            while (true) {
                for (var c = 0; c < 2; c++) {
                    if (this.modules[row][col - c] === null) {
                        var dark = false;
                        if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
                        var mask = QRUtil.getMask(maskPattern, row, col - c);
                        if (mask) dark = !dark;
                        this.modules[row][col - c] = dark;
                        bitIndex--;
                        if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
                    }
                }
                row += inc;
                if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
            }
        }
    };
    QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
        var rsBlocks = RSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
        var buffer = new BitBuffer();
        for (var i = 0; i < dataList.length; i++) {
            var data = dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
            data.write(buffer);
        }
        var totalDataCount = 0;
        for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
        if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error('code length overflow');
        if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
        while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(false);
        while (true) {
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(PAD0, 8);
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(PAD1, 8);
        }
        return QRCode.createBytes(buffer, rsBlocks);
    };
    QRCode.createBytes = function(buffer, rsBlocks) {
        var offset = 0, maxDcCount = 0, maxEcCount = 0;
        var dcdata = new Array(rsBlocks.length), ecdata = new Array(rsBlocks.length);
        for (var r = 0; r < rsBlocks.length; r++) {
            var dcCount = rsBlocks[r].dataCount, ecCount = rsBlocks[r].totalCount - dcCount;
            maxDcCount = Math.max(maxDcCount, dcCount);
            maxEcCount = Math.max(maxEcCount, ecCount);
            dcdata[r] = new Array(dcCount);
            for (var i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
            offset += dcCount;
            var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
            var rawPoly = new Polynomial(dcdata[r], rsPoly.getLength() - 1);
            var modPoly = rawPoly.mod(rsPoly);
            ecdata[r] = new Array(rsPoly.getLength() - 1);
            for (var i = 0; i < ecdata[r].length; i++) {
                var modIndex = i + modPoly.getLength() - ecdata[r].length;
                ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
            }
        }
        var totalCodeCount = 0;
        for (var i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
        var data = new Array(totalCodeCount), index = 0;
        for (var i = 0; i < maxDcCount; i++) for (var r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) data[index++] = dcdata[r][i];
        for (var i = 0; i < maxEcCount; i++) for (var r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) data[index++] = ecdata[r][i];
        return data;
    };

    function QR8bitByte(data) { this.mode = 4; this.data = data; }
    QR8bitByte.prototype.getLength = function() {
        var length = 0;
        for (var i = 0; i < this.data.length; i++) {
            var code = this.data.charCodeAt(i);
            if (code < 0x80) length += 1;
            else if (code < 0x800) length += 2;
            else if (code < 0x10000) length += 3;
            else length += 4;
        }
        return length;
    };
    QR8bitByte.prototype.write = function(buffer) {
        for (var i = 0; i < this.data.length; i++) {
            var code = this.data.charCodeAt(i);
            if (code < 0x80) buffer.put(code, 8);
            else if (code < 0x800) { buffer.put(0xC0 | (code >> 6), 8); buffer.put(0x80 | (code & 0x3F), 8); }
            else if (code < 0x10000) { buffer.put(0xE0 | (code >> 12), 8); buffer.put(0x80 | ((code >> 6) & 0x3F), 8); buffer.put(0x80 | (code & 0x3F), 8); }
            else { buffer.put(0xF0 | (code >> 18), 8); buffer.put(0x80 | ((code >> 12) & 0x3F), 8); buffer.put(0x80 | ((code >> 6) & 0x3F), 8); buffer.put(0x80 | (code & 0x3F), 8); }
        }
    };

    var QRUtil = {
        PATTERN_POSITION_TABLE: PATTERN_POSITION_TABLE,
        G15: (1<<10)|(1<<8)|(1<<5)|(1<<4)|(1<<2)|(1<<1)|(1<<0),
        G18: (1<<12)|(1<<11)|(1<<10)|(1<<9)|(1<<8)|(1<<5)|(1<<2)|(1<<0),
        G15_MASK: (1<<14)|(1<<12)|(1<<10)|(1<<4)|(1<<1),
        getBCHTypeInfo: function(data) {
            var d = data << 10;
            while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
            return ((data << 10) | d) ^ QRUtil.G15_MASK;
        },
        getBCHTypeNumber: function(data) {
            var d = data << 12;
            while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
            return (data << 12) | d;
        },
        getBCHDigit: function(data) { var digit = 0; while (data !== 0) { digit++; data >>>= 1; } return digit; },
        getLengthInBits: function(mode, type) {
            if (1 <= type && type < 10) { switch(mode) { case 1: return 10; case 2: return 9; case 4: return 8; case 8: return 8; } }
            else if (type < 27) { switch(mode) { case 1: return 12; case 2: return 11; case 4: return 16; case 8: return 10; } }
            else if (type < 41) { switch(mode) { case 1: return 14; case 2: return 13; case 4: return 16; case 8: return 12; } }
            throw new Error('type:' + type);
        },
        getLostPoint: function(qrCode) {
            var moduleCount = qrCode.moduleCount, lostPoint = 0;
            for (var row = 0; row < moduleCount; row++) for (var col = 0; col < moduleCount; col++) {
                var sameCount = 0, dark = qrCode.modules[row][col];
                for (var r = -1; r <= 1; r++) {
                    if (row + r < 0 || moduleCount <= row + r) continue;
                    for (var c = -1; c <= 1; c++) {
                        if (col + c < 0 || moduleCount <= col + c) continue;
                        if (r === 0 && c === 0) continue;
                        if (dark === qrCode.modules[row + r][col + c]) sameCount++;
                    }
                }
                if (sameCount > 5) lostPoint += (3 + sameCount - 5);
            }
            for (var row = 0; row < moduleCount - 1; row++) for (var col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.modules[row][col]) count++;
                if (qrCode.modules[row + 1][col]) count++;
                if (qrCode.modules[row][col + 1]) count++;
                if (qrCode.modules[row + 1][col + 1]) count++;
                if (count === 0 || count === 4) lostPoint += 3;
            }
            for (var row = 0; row < moduleCount; row++) for (var col = 0; col < moduleCount - 6; col++) {
                if (qrCode.modules[row][col] && !qrCode.modules[row][col + 1] && qrCode.modules[row][col + 2] && qrCode.modules[row][col + 3] && qrCode.modules[row][col + 4] && !qrCode.modules[row][col + 5] && qrCode.modules[row][col + 6]) lostPoint += 40;
            }
            for (var col = 0; col < moduleCount; col++) for (var row = 0; row < moduleCount - 6; row++) {
                if (qrCode.modules[row][col] && !qrCode.modules[row + 1][col] && qrCode.modules[row + 2][col] && qrCode.modules[row + 3][col] && qrCode.modules[row + 4][col] && !qrCode.modules[row + 5][col] && qrCode.modules[row + 6][col]) lostPoint += 40;
            }
            var darkCount = 0;
            for (var col = 0; col < moduleCount; col++) for (var row = 0; row < moduleCount; row++) { if (qrCode.modules[row][col]) darkCount++; }
            var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
            lostPoint += ratio * 10;
            return lostPoint;
        },
        getMask: function(maskPattern, i, j) {
            switch(maskPattern) {
                case 0: return (i + j) % 2 === 0;
                case 1: return i % 2 === 0;
                case 2: return j % 3 === 0;
                case 3: return (i + j) % 3 === 0;
                case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
                case 5: return (i * j) % 2 + (i * j) % 3 === 0;
                case 6: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
                case 7: return ((i + j) % 2 + (i * j) % 3) % 2 === 0;
                default: throw new Error('bad maskPattern');
            }
        },
        getErrorCorrectPolynomial: function(errorCorrectLength) {
            var a = new Polynomial([1], 0);
            for (var i = 0; i < errorCorrectLength; i++) a = a.multiply(new Polynomial([1, gexp(i)], 0));
            return a;
        }
    };

    return function(text, eccLevel, size) {
        var ecMap = {L: 1, M: 0, Q: 3, H: 2};
        var ecl = ecMap[eccLevel] || 1;
        var typeNumber = 0;
        for (var i = 1; i <= 10; i++) {
            var buffer = new BitBuffer();
            buffer.put(4, 4);
            buffer.put(text.length, i <= 9 ? 8 : 16);
            for (var j = 0; j < text.length; j++) {
                var code = text.charCodeAt(j);
                if (code < 0x80) buffer.put(code, 8);
                else if (code < 0x800) { buffer.put(0xC0|(code>>6), 8); buffer.put(0x80|(code&0x3F), 8); }
                else if (code < 0x10000) { buffer.put(0xE0|(code>>12), 8); buffer.put(0x80|((code>>6)&0x3F), 8); buffer.put(0x80|(code&0x3F), 8); }
            }
            var rsBlocks = RSBlock.getRSBlocks(i, ecl);
            var totalDataCount = 0;
            for (var j = 0; j < rsBlocks.length; j++) totalDataCount += rsBlocks[j].dataCount;
            if (buffer.getLengthInBits() <= totalDataCount * 8) { typeNumber = i; break; }
        }
        if (typeNumber === 0) return null;
        var qr = new QRCode(typeNumber, ecl);
        qr.addData(text);
        qr.make();
        return qr;
    };
})();

// PDF Preview helper function
function renderPdfPreview(file, callback) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        callback(null);
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        var arrayBuffer = e.target.result;
        ensurePdfJs();
        pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise.then(function(pdf) {
            pdf.getPage(1).then(function(page) {
                var viewport = page.getViewport({ scale: 1 });
                var canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.maxWidth = '200px';
                canvas.style.borderRadius = 'var(--radius-sm)';
                canvas.style.border = '1px solid var(--border-color)';
                canvas.style.boxShadow = 'var(--shadow-sm)';
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
                    callback(canvas);
                });
            });
        }).catch(function() {
            callback(null);
        });
    };
    reader.readAsArrayBuffer(file);
}

function generateQRCodeNative(canvas, text, size) {
    if (!text) text = ' ';
    size = size || 250;
    var qr = QRCodeGenerator(text, 'L', size);
    if (!qr) { canvas.width = size; canvas.height = size; return; }
    var ctx = canvas.getContext('2d');
    var n = qr.moduleCount;
    var cell = Math.floor(size / (n + 8));
    var off = Math.floor((size - cell * n) / 2);
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
            if (qr.modules[r][c]) {
                ctx.fillRect(off + c * cell, off + r * cell, cell + 0.5, cell + 0.5);
            }
        }
    }
}
