import { requestApi, responseRows } from './admin-api.js';
import { resolveImportService } from './admin-import-service.js';

import { element, imageUrl, setBackground } from './admin-dom.js';
// ==========================================// Config// ==========================================
const API_BASE = location.origin;

const TOKEN_KEY = 'power_admin_token';

const EMAIL_KEY = 'power_admin_email';

const SERVICES = [

  { slug: 'industrial-electricity', name: 'الكهرباء الصناعية' },

  { slug: 'residential-electricity', name: 'الكهرباء المنزلية' },

  { slug: 'solar-energy', name: 'الطاقة الشمسية' },

  { slug: 'iot-smart-solutions', name: 'إنترنت الأشياء والحلول الذكية' },

];

let serviceIdBySlug = Object.create(null);

let currentServiceSlug = null;

let categories = [];

let currentCategoryId = null;

let items = [];

let editingCategoryId = null;

let editingItemId = null;

let editingItemVersion = null;

let previewUrl = null;

const $ = (id) => document.getElementById(id);

function showToast(msg) {

  const t = $('toast');

  t.textContent = msg;

  t.classList.add('show');

  setTimeout(() => t.classList.remove('show'), 2200);

}
// ==========================================// Auth// ==========================================
function getToken() {

  return localStorage.getItem(TOKEN_KEY);

}

function authHeaders() {

  return {

    Authorization: `Bearer ${getToken()}`

  };

}

async function apiFetch(url, options = {}) {

  return requestApi(url, options, logout);

}

function showDashboard() {

  $('loginScreen').style.display = 'none';

  $('accountEmail').textContent =

    localStorage.getItem(EMAIL_KEY) || '';

  loadServices().catch(err => showToast(err.message));

}

function showLogin() {

  $('loginScreen').style.display = 'flex';

}

function logout() {

  localStorage.removeItem(TOKEN_KEY);

  localStorage.removeItem(EMAIL_KEY);

  document

    .querySelectorAll('dialog[open]')

    .forEach(dialog => dialog.close());

  showLogin();

}

$('loginBtn').onclick = async () => {

  const email = $('loginEmail').value.trim();

  const password = $('loginPassword').value;

  const errBox = $('loginError');

  errBox.style.display = 'none';

  if (!email || !password) {

    errBox.textContent = 'لازم تعبي الإيميل والباسورد';

    errBox.style.display = 'block';

    return;

  }

  try {

    const res = await apiFetch(`${API_BASE}/api/auth/login`, {

      method: 'POST',

      headers: {

        'Content-Type': 'application/json'

      },

      body: JSON.stringify({

        email,

        password

      }),

    });

    const data = await res.json();

    if (

      typeof data.token !== 'string' ||

      !data.token ||

      typeof data.email !== 'string'

    ) {

      throw new Error('استجابة تسجيل الدخول غير صالحة');

    }

    localStorage.setItem(TOKEN_KEY, data.token);

    localStorage.setItem(EMAIL_KEY, data.email);

    $('loginPassword').value = '';

    showDashboard();

  } catch (err) {

    errBox.textContent = err.message;

    errBox.style.display = 'block';

  }

};

$('logoutBtn').onclick = logout;
// ==========================================// Services// ==========================================
async function loadServices() {

  const res = await apiFetch(`${API_BASE}/api/services`);

  const data = await responseRows(res);

  data.forEach(s => {

    serviceIdBySlug[s.slug] = s.id;

  });

  const nav = $('serviceTabs');

  nav.replaceChildren();

  SERVICES.forEach(s => {

    const btn = document.createElement('button');

    btn.textContent = s.name;

    btn.dataset.slug = s.slug;

    btn.onclick = () => {

      selectService(s.slug);

    };

    nav.appendChild(btn);

  });

  if (SERVICES.length) {

    selectService(SERVICES[0].slug);

  }

}

function selectService(slug) {

  currentServiceSlug = slug;

  const service = SERVICES.find(s => s.slug === slug);

  $('serviceTitle').textContent =

    `التصنيفات — ${service.name}`;

  document

    .querySelectorAll('#serviceTabs button')

    .forEach(b => {

      b.classList.toggle(

        'active',

        b.dataset.slug === slug

      );

    });

  currentCategoryId = null;

  $('itemsSection').style.display = 'none';

  loadCategories(slug)

    .catch(err => showToast(err.message));

}
// ==========================================// Categories// ==========================================
async function loadCategories(slug) {

  const res = await apiFetch(

    `${API_BASE}/api/categories/service/${encodeURIComponent(slug)}`

  );

  const rows = await responseRows(res);

  if (slug !== currentServiceSlug) {

    return;

  }

  categories = rows;

  renderCategoryTabs();

  if (categories.length) {

    selectCategory(categories[0].id);

  } else {

    $('itemsSection').style.display = 'none';

  }

}

function renderCategoryTabs() {

  const wrap = $('categoryTabs');

  wrap.replaceChildren();

  if (!categories.length) {

    wrap.append(

      element(

        'div',

        'empty-state',

        'ما في تصنيفات بعد لهاد السيرفيس. يمكنك إضافة تصنيف أو استيراده من Excel.'

      )

    );

    return;

  }

  categories.forEach(cat => {

    const pill = document.createElement('div');

    pill.className =

      'category-pill' +

      (cat.id === currentCategoryId ? ' active' : '');

    const label = element(

      'span',

      '',

      cat.name_ar

    );

    const remove = element(

      'span',

      'x',

      '×'

    );

    remove.title = 'حذف';

    label.onclick = () => {

      selectCategory(cat.id);

    };

    remove.onclick = (e) => {

      e.stopPropagation();

      deleteCategory(cat.id);

    };

    pill.append(

      label,

      remove

    );

    wrap.appendChild(pill);

  });

}

function selectCategory(id) {

  currentCategoryId = id;

  renderCategoryTabs();

  const cat =

    categories.find(c => c.id === id);

  $('categoryItemsTitle').textContent =

    `الأصناف — ${cat ? cat.name_ar : ''}`;

  $('itemsSection').style.display = 'block';

  loadItems(id)

    .catch(err => showToast(err.message));

}

async function deleteCategory(id) {

  if (

    !confirm(

      'حذف هاد التصنيف بيحذف كل الأصناف يلي جواه كمان. أكيدة؟'

    )

  ) {

    return;

  }

  try {

    await apiFetch(

      `${API_BASE}/api/categories/${id}`,

      {

        method: 'DELETE',

        headers: authHeaders()

      }

    );

    showToast('تم الحذف');

    await loadCategories(

      currentServiceSlug

    );

  } catch (err) {

    showToast(err.message);

  }

}

$('addCategoryBtn').onclick = () => {

  editingCategoryId = null;

  $('categoryDialogTitle').textContent =

    'إضافة تصنيف';

  $('catNameAr').value = '';

  $('catNameEn').value = '';

  $('catNameHe').value = '';

  categoryDialog.showModal();

};

$('saveCategoryBtn').onclick = async () => {

  const name_ar =

    $('catNameAr').value.trim();

  const name_en =

    $('catNameEn').value.trim();

  const name_he =

    $('catNameHe').value.trim();

  if (

    !name_ar ||

    !name_en ||

    !name_he

  ) {

    showToast(

      'لازم تعبي الاسم بالتلات لغات'

    );

    return;

  }

  const body = {

    name_ar,

    name_en,

    name_he,

    service_id:

      serviceIdBySlug[currentServiceSlug]

  };

  const headers = {

    'Content-Type': 'application/json',

    ...authHeaders()

  };

  try {

    if (editingCategoryId) {

      await apiFetch(

        `${API_BASE}/api/categories/${editingCategoryId}`,

        {

          method: 'PUT',

          headers,

          body: JSON.stringify(body)

        }

      );

    } else {

      await apiFetch(

        `${API_BASE}/api/categories`,

        {

          method: 'POST',

          headers,

          body: JSON.stringify(body)

        }

      );

    }

    categoryDialog.close();

    showToast('تم الحفظ');

    await loadCategories(

      currentServiceSlug

    );

  } catch (err) {

    showToast(err.message);

  }

};
// ==========================================// Items// ==========================================
async function loadItems(categoryId) {

  const res = await apiFetch(

    `${API_BASE}/api/items/category/${categoryId}`

  );

  const rows =

    await responseRows(res);

  if (

    categoryId !== currentCategoryId

  ) {

    return;

  }

  items = rows;

  renderItems();

}

function renderItems() {

  const grid = $('itemsGrid');

  grid.replaceChildren();

  if (!items.length) {

    grid.append(

      element(

        'div',

        'empty-state',

        'ما في أصناف بعد بهاد التصنيف. دوسي "+ إضافة صنف" عشان تبدئي.'

      )

    );

    return;

  }

  items.forEach(item => {

    const card =

      document.createElement('div');

    card.className = 'item-card';

    const url =

      imageUrl(

        API_BASE,

        item.image_url

      );

    const thumb =

      element(

        'div',

        'thumb',

        url ? '' : 'بدون صورة'

      );

    setBackground(

      thumb,

      url

    );

    const body =

      element(

        'div',

        'body'

      );

    const actions =

      element(

        'div',

        'actions'

      );

    const edit =

      element(

        'button',

        'btn btn-secondary btn-sm',

        'تعديل'

      );

    const remove =

      element(

        'button',

        'btn btn-danger btn-sm',

        'حذف'

      );

    edit.onclick = () => {

      openItemDialog(item);

    };

    remove.onclick = () => {

      deleteItem(item.id);

    };

    actions.append(

      edit,

      remove

    );

    body.append(

      element(

        'h4',

        '',

        item.title_ar

      ),

      element(

        'p',

        '',

        item.description_ar

      ),

      actions

    );

    card.append(

      thumb,

      body

    );

    grid.appendChild(card);

  });

}

async function deleteItem(id) {

  if (

    !confirm('حذف هاد الصنف؟')

  ) {

    return;

  }

  try {

    await apiFetch(

      `${API_BASE}/api/items/${id}`,

      {

        method: 'DELETE',

        headers: authHeaders()

      }

    );

    showToast('تم الحذف');

    await loadItems(

      currentCategoryId

    );

  } catch (err) {

    showToast(err.message);

  }

}

$('addItemBtn').onclick = () => {

  openItemDialog(null);

};

function openItemDialog(item) {

  editingItemId =

    item ? item.id : null;

  editingItemVersion =

    item ? item.version : null;

  if (previewUrl) {

    URL.revokeObjectURL(

      previewUrl

    );

    previewUrl = null;

  }

  $('itemDialogTitle').textContent =

    item

      ? 'تعديل صنف'

      : 'إضافة صنف';

  $('titleAr').value =

    item ? item.title_ar : '';

  $('titleEn').value =

    item ? item.title_en : '';

  $('titleHe').value =

    item ? item.title_he : '';

  $('descAr').value =

    item

      ? (item.description_ar || '')

      : '';

  $('descEn').value =

    item

      ? (item.description_en || '')

      : '';

  $('descHe').value =

    item

      ? (item.description_he || '')

      : '';

  $('itemImage').value = '';

  const preview =

    $('imagePreview');

  if (

    item &&

    item.image_url

  ) {

    setBackground(

      preview,

      imageUrl(

        API_BASE,

        item.image_url

      )

    );

    preview.textContent = '';

  } else {

    preview.style.backgroundImage = '';

    preview.textContent =

      'بدون صورة';

  }

  itemDialog.showModal();

}

$('itemImage').addEventListener(

  'change',

  (e) => {

    const file =

      e.target.files[0];

    const preview =

      $('imagePreview');

    if (file) {

      if (

        file.size >

          5 * 1024 * 1024 ||

        ![

          'image/jpeg',

          'image/png',

          'image/webp',

          'image/gif',

          'image/avif'

        ].includes(file.type)

      ) {

        e.target.value = '';

        showToast(

          'اختاري صورة JPG/PNG/WebP/GIF/AVIF لا تتجاوز 5MB'

        );

        return;

      }

      if (previewUrl) {

        URL.revokeObjectURL(

          previewUrl

        );

      }

      previewUrl =

        URL.createObjectURL(file);

      setBackground(

        preview,

        previewUrl

      );

      preview.textContent = '';

    }

  }

);

$('saveItemBtn').onclick =

  async () => {

    const title_ar =

      $('titleAr').value.trim();

    const title_en =

      $('titleEn').value.trim();

    const title_he =

      $('titleHe').value.trim();

    if (

      !title_ar ||

      !title_en ||

      !title_he

    ) {

      showToast(

        'لازم تعبي العنوان بالتلات لغات'

      );

      return;

    }

    const form =

      new FormData();

    if (

      editingItemId &&

      editingItemVersion != null

    ) {

      form.append(

        'version',

        editingItemVersion

      );

    }

    form.append(

      'category_id',

      currentCategoryId

    );

    form.append(

      'title_ar',

      title_ar

    );

    form.append(

      'title_en',

      title_en

    );

    form.append(

      'title_he',

      title_he

    );

    form.append(

      'description_ar',

      $('descAr').value.trim()

    );

    form.append(

      'description_en',

      $('descEn').value.trim()

    );

    form.append(

      'description_he',

      $('descHe').value.trim()

    );

    const file =

      $('itemImage').files[0];

    if (file) {

      form.append(

        'image',

        file

      );

    }

    try {

      if (editingItemId) {

        await apiFetch(

          `${API_BASE}/api/items/${editingItemId}`,

          {

            method: 'PUT',

            headers: authHeaders(),

            body: form

          }

        );

      } else {

        await apiFetch(

          `${API_BASE}/api/items`,

          {

            method: 'POST',

            headers: authHeaders(),

            body: form

          }

        );

      }

      itemDialog.close();

      showToast('تم الحفظ');

      await loadItems(

        currentCategoryId

      );

    } catch (err) {

      showToast(err.message);

    }

  };
// ==========================================// Excel Import + Embedded Images// ==========================================
let importRows = [];

let importImageUrls = [];

function clearImportImageUrls() {

  importImageUrls.forEach(url => {

    try {

      URL.revokeObjectURL(url);

    } catch {}

  });

  importImageUrls = [];

}

function xmlDocument(text) {

  const doc =

    new DOMParser().parseFromString(

      text,

      'application/xml'

    );

  if (doc.querySelector('parsererror')) {

    throw new Error(

      'تعذر قراءة معلومات الصور داخل ملف Excel'

    );

  }

  return doc;

}

function mimeFromImagePath(path) {

  const ext =

    String(path)

      .split('.')

      .pop()

      .toLowerCase();

  if (ext === 'png') return 'image/png';

  if (

    ext === 'jpg' ||

    ext === 'jpeg'

  ) {

    return 'image/jpeg';

  }

  if (ext === 'webp') return 'image/webp';

  if (ext === 'gif') return 'image/gif';

  if (ext === 'avif') return 'image/avif';

  return 'application/octet-stream';

}

function normalizeZipPath(baseDir, target) {

  if (!target) {

    return '';

  }

  if (target.startsWith('/')) {

    return target.replace(/^\/+/, '');

  }

  const parts =

    `${baseDir}/${target}`

      .split('/');

  const normalized = [];

  parts.forEach(part => {

    if (

      !part ||

      part === '.'

    ) {

      return;

    }

    if (part === '..') {

      normalized.pop();

      return;

    }

    normalized.push(part);

  });

  return normalized.join('/');

}

function excelImageColumn(headers) {
  const column = headers.findIndex(value =>
    ['الصورة', 'صورة', 'image', 'photo', 'picture', 'תמונה'].includes(normalizedKey(value))
  );
  // Older templates without an image heading used column B.
  return column === -1 ? 1 : column;
}

async function extractExcelImages(file, imageColumn = 1) {

  if (!globalThis.JSZip) {

    throw new Error(

      'مكتبة قراءة صور Excel لم يتم تحميلها'

    );

  }

  const zip =

    await JSZip.loadAsync(file);

  const sheetRelsPath =

    'xl/worksheets/_rels/sheet1.xml.rels';

  const sheetRelsFile =

    zip.file(sheetRelsPath);

  if (!sheetRelsFile) {

    return new Map();

  }

  const sheetRelsDoc =

    xmlDocument(

      await sheetRelsFile.async('text')

    );

  const drawingRelationship =

    [

      ...sheetRelsDoc

        .getElementsByTagNameNS(

          '*',

          'Relationship'

        )

    ].find(rel =>

      String(

        rel.getAttribute('Type') || ''

      ).endsWith('/drawing')

    );

  if (!drawingRelationship) {

    return new Map();

  }

  const drawingPath =

    normalizeZipPath(

      'xl/worksheets',

      drawingRelationship

        .getAttribute('Target') || ''

    );

  const drawingFile =

    zip.file(drawingPath);

  if (!drawingFile) {

    throw new Error(

      'تم العثور على معلومات الصور لكن تعذر فتح Drawing الخاص بها'

    );

  }

  const drawingDoc =

    xmlDocument(

      await drawingFile.async('text')

    );

  const drawingName =

    drawingPath

      .split('/')

      .pop();

  const drawingDir =

    drawingPath

      .split('/')

      .slice(0, -1)

      .join('/');

  const drawingRelsPath =

    `${drawingDir}/_rels/${drawingName}.rels`;

  const drawingRelsFile =

    zip.file(drawingRelsPath);

  if (!drawingRelsFile) {

    throw new Error(

      'تعذر العثور على علاقات الصور داخل ملف Excel'

    );

  }

  const drawingRelsDoc =

    xmlDocument(

      await drawingRelsFile.async('text')

    );

  const relationMap =

    new Map();

  [

    ...drawingRelsDoc

      .getElementsByTagNameNS(

        '*',

        'Relationship'

      )

  ].forEach(rel => {

    const id =

      rel.getAttribute('Id');

    const target =

      rel.getAttribute('Target') || '';

    if (!id || !target) {

      return;

    }

    relationMap.set(

      id,

      normalizeZipPath(

        drawingDir,

        target

      )

    );

  });

  const anchors = [

    ...drawingDoc

      .getElementsByTagNameNS(

        '*',

        'oneCellAnchor'

      ),

    ...drawingDoc

      .getElementsByTagNameNS(

        '*',

        'twoCellAnchor'

      )

  ];

  const result =

    new Map();

  for (const anchor of anchors) {

    const from =

      anchor

        .getElementsByTagNameNS(

          '*',

          'from'

        )[0];

    if (!from) {

      continue;

    }

    const rowNode =

      from

        .getElementsByTagNameNS(

          '*',

          'row'

        )[0];

    const colNode =

      from

        .getElementsByTagNameNS(

          '*',

          'col'

        )[0];

    if (

      !rowNode ||

      !colNode

    ) {

      continue;

    }

    const zeroBasedColumn =

      Number(colNode.textContent);
    if (zeroBasedColumn !== imageColumn) {

      continue;

    }

    const excelRowNumber =

      Number(rowNode.textContent) + 1;

    const blip =

      anchor

        .getElementsByTagNameNS(

          '*',

          'blip'

        )[0];

    if (!blip) {

      continue;

    }

    const relationshipId =

      blip.getAttributeNS(

        'http\://schemas.openxmlformats.org/officeDocument/2006/relationships',

        'embed'

      ) ||

      blip.getAttribute('r:embed');

    if (!relationshipId) {

      continue;

    }

    const mediaPath =

      relationMap.get(

        relationshipId

      );

    if (!mediaPath) {

      continue;

    }

    const mediaFile =

      zip.file(mediaPath);

    if (!mediaFile) {

      continue;

    }

    const mime =

      mimeFromImagePath(

        mediaPath

      );

    if (!mime.startsWith('image/')) {

      continue;

    }

    const bytes =

      await mediaFile.async(

        'uint8array'

      );

    const ext =

      mediaPath

        .split('.')

        .pop()

        .toLowerCase();

    const imageFile =

      new File(

        [bytes],

        `excel-product-row-${excelRowNumber}.${ext}`,

        {

          type: mime

        }

      );

    const previewUrl =

      URL.createObjectURL(

        imageFile

      );

    importImageUrls.push(

      previewUrl

    );

    result.set(

      excelRowNumber,

      {

        file: imageFile,

        url: previewUrl,

        path: mediaPath

      }

    );

  }

  return result;

}const COLUMN_ALIASES = {

  service_slug: [

    'service_slug',

    'service',

    'service slug'

  ],

  category_ar: [

    'category_ar',

    'category ar',

    'category arabic',

    'التصنيف عربي',

    'التصنيف بالعربي',

    'الفئة - عربي',

    'الفئة عربي'

  ],

  category_en: [

    'category_en',

    'category en',

    'category english',

    'التصنيف انجليزي',

    'التصنيف بالانجليزي',

    'الفئة - English',

    'الفئة English',

    'Category - English'

  ],

  category_he: [

    'category_he',

    'category he',

    'category hebrew',

    'التصنيف عبري',

    'التصنيف بالعبري',

    'الفئة - עברית',

    'الفئة עברית',

    'קטגוריה - עברית'

  ],

  title_ar: [

    'title_ar',

    'title ar',

    'name_ar',

    'name ar',

    'product_ar',

    'اسم عربي',

    'الاسم بالعربي',

    'اسم المنتج - عربي',

    'اسم المنتج عربي'

  ],

  title_en: [

    'title_en',

    'title en',

    'name_en',

    'name en',

    'product_en',

    'اسم انجليزي',

    'الاسم بالانجليزي',

    'اسم المنتج - English',

    'اسم المنتج English',

    'Product Name - English'

  ],

  title_he: [

    'title_he',

    'title he',

    'name_he',

    'name he',

    'product_he',

    'اسم عبري',

    'الاسم بالعبري',

    'اسم المنتج - עברית',

    'اسم المنتج עברית',

    'שם המוצר - עברית'

  ],

  description_ar: [

    'description_ar',

    'description ar',

    'desc_ar',

    'وصف عربي',

    'الوصف بالعربي',

    'الوصف - عربي'

  ],

  description_en: [

    'description_en',

    'description en',

    'desc_en',

    'وصف انجليزي',

    'الوصف بالانجليزي',

    'الوصف - English',

    'Description - English'

  ],

  description_he: [

    'description_he',

    'description he',

    'desc_he',

    'وصف عبري',

    'الوصف بالعبري',

    'الوصف - עברית',

    'תיאור - עברית'

  ],

};

function normalizedKey(value) {

  return String(value ?? '')

    .trim()

    .toLowerCase()

    .replace(/[-\s]+/g, ' ');

}

function cell(row, key) {

  const entries =

    Object.entries(row);

  for (

    const alias

    of COLUMN_ALIASES[key]

  ) {

    const wanted =

      normalizedKey(alias)

        .replace(/ /g, '_');

    const hit =

      entries.find(([k]) =>

        normalizedKey(k)

          .replace(/ /g, '_') ===

        wanted

      );

    if (hit) {

      return String(

        hit[1] ?? ''

      ).trim();

    }

  }

  return '';

}

function normalizeImportRow(

  row,

  excelRowNumber

) {

  const out = {

    rowNumber: excelRowNumber

  };

  Object

    .keys(COLUMN_ALIASES)

    .forEach(k => {

      out[k] = cell(row, k);

    });
  const service = resolveImportService(row);
  out.service_slug = service.slug;
  out.errors = service.error ? [service.error] : [];

  if (

    !SERVICES.some(

      s =>

        s.slug ===

        out.service_slug

    )

  ) {

    out.errors.push(

      'Service غير معروف'

    );

  }

  if (!out.category_ar) {

    out.errors.push(

      'التصنيف العربي ناقص'

    );

  }

  if (

    !out.title_ar ||

    !out.title_en ||

    !out.title_he

  ) {

    out.errors.push(

      'اسم الصنف لازم يكون باللغات الثلاث'

    );

  }

  if (

    out.category_ar &&

    (

      !out.category_en ||

      !out.category_he

    )

  ) {

    out.errors.push(

      'اسم التصنيف لازم يكون باللغات الثلاث'

    );

  }

  return out;

}
// ==========================================// عرض معاينة Excel// ==========================================
function renderImportPreview() {

  const box =

    $('importPreview');

  const summary =

    $('importSummary');

  const valid =

    importRows.filter(

      r => !r.errors.length

    ).length;

  const invalid =

    importRows.length - valid;

  summary.style.display =

    'block';

  summary.textContent =

    `إجمالي الصفوف: ${importRows.length} — جاهز للاستيراد: ${valid} — فيه أخطاء: ${invalid}`;
  const distribution = SERVICES.map(service => {
    const rows = importRows.filter(row => row.service_slug === service.slug);
    const categories = new Set(rows.map(row => row.category_ar));
    return rows.length ? `${service.name}: ${rows.length} منتج / ${categories.size} تصنيف` : '';
  }).filter(Boolean);
  summary.textContent += ` — ${distribution.join(' — ')}`;
  const imageCount = importRows.filter(row => row.image?.url).length;
  summary.textContent += ` — بالصور: ${imageCount} — بدون صورة: ${importRows.length - imageCount}`;

  $('confirmImportBtn').disabled =

    !importRows.length ||

    invalid > 0;

  const wrap =

    element(

      'div',

      'import-table-wrap'

    );

  const table =

    element(

      'table',

      'import-table'

    );

  const thead =

    document.createElement(

      'thead'

    );

  const hr =

    document.createElement(

      'tr'

    );

  [

    'الصف',

    'الصورة',

    'الخدمة',

    'التصنيف',

    'العنوان عربي',

    'العنوان English',

    'العنوان עברית',

    'الحالة'

  ].forEach(h => {

    hr.append(

      element(

        'th',

        '',

        h

      )

    );

  });

  thead.append(hr);

  table.append(thead);

  const tbody =

    document.createElement(

      'tbody'

    );

  importRows.forEach(r => {

    const tr =

      document.createElement(

        'tr'

      );
// رقم صف Excel
    tr.append(

      element(

        'td',

        '',

        r.rowNumber

      )

    );
// صورة المنتج
    const imageCell =

      document.createElement(

        'td'

      );

    if (r.image?.url) {

      const img =

        document.createElement(

          'img'

        );

      img.src =

        r.image.url;

      img.alt =

        r.title_ar ||

        'صورة المنتج';

      img.style.width =

        '64px';

      img.style.height =

        '64px';

      img.style.objectFit =

        'contain';

      img.style.background =

        '#fff';

      img.style.borderRadius =

        '6px';

      img.style.border =

        '1px solid #e2e5ea';

      imageCell.appendChild(

        img

      );

    } else {

      imageCell.appendChild(

        element(

          'span',

          'import-error',

          'بدون صورة'

        )

      );

    }

    tr.appendChild(

      imageCell

    );

    [

      SERVICES.find(service => service.slug === r.service_slug)?.name || r.service_slug,

      r.category_ar,

      r.title_ar,

      r.title_en,

      r.title_he

    ].forEach(v => {

      tr.append(

        element(

          'td',

          '',

          v

        )

      );

    });

    tr.append(

      element(

        'td',

        r.errors.length

          ? 'import-error'

          : 'import-ok',

        r.errors.length

          ? r.errors.join('، ')

          : 'جاهز'

      )

    );

    tbody.append(tr);

  });

  table.append(tbody);

  wrap.append(table);

  box.replaceChildren(wrap);

}
// ==========================================// فتح وإغلاق نافذة Excel// ==========================================
$('importExcelBtn').onclick =

  () => {

    clearImportImageUrls();

    importRows = [];

    $('excelFile').value = '';

    $('importSummary').style.display =

      'none';

    $('importPreview')

      .replaceChildren();

    $('confirmImportBtn').disabled =

      true;

    $('importExcelDialog')

      .showModal();

  };

$('cancelImportBtn').onclick =

  () => {

    $('importExcelDialog').close();

    clearImportImageUrls();

    importRows = [];

  };
// ==========================================// قراءة Excel// واكتشاف صف العناوين// واستخراج الصور// ==========================================
$('excelFile').addEventListener(

  'change',

  async (e) => {

    const file =

      e.target.files[0];

    if (!file) {

      return;

    }

    try {

      clearImportImageUrls();

      if (!globalThis.XLSX) {

        throw new Error(

          'مكتبة قراءة Excel لم يتم تحميلها'

        );

      }

      if (!globalThis.JSZip) {

        throw new Error(

          'مكتبة قراءة صور Excel لم يتم تحميلها'

        );

      }
// نقرأ بيانات Excel.
      const arrayBuffer =

        await file.arrayBuffer();

      const workbook =

        XLSX.read(

          arrayBuffer,

          {

            type: 'array'

          }

        );

      if (

        !workbook.SheetNames ||

        !workbook.SheetNames.length

      ) {

        throw new Error(

          'ملف Excel لا يحتوي على Sheets'

        );

      }

      const sheet =

        workbook.Sheets[

          workbook.SheetNames[0]

        ];

      if (!sheet) {

        throw new Error(

          'تعذر قراءة أول Sheet في ملف Excel'

        );

      }
// نقرأ الشيت كمصفوفة،// لأن صف العناوين ليس أول صف.
      const rows =

        XLSX.utils.sheet_to_json(

          sheet,

          {

            header: 1,

            // Preserve absolute row/column positions when Excel's used range starts after A1.
            range: { s: { r: 0, c: 0 }, e: XLSX.utils.decode_range(sheet['!ref'] || 'A1').e },

            defval: '',

            raw: false

          }

        );

      if (!rows.length) {

        throw new Error(

          'ملف Excel لا يحتوي على بيانات'

        );

      }
// نبحث تلقائياً عن صف العناوين.
      const headerIndex =

        rows.findIndex(row => {

          const values =

            row.map(v =>

              normalizedKey(v)

            );

          const hasProduct =

            values.some(v =>

              v.includes(

                'اسم المنتج'

              ) ||

              v === 'title_ar' ||

              v === 'title ar'

            );

          const hasCategory =

            values.some(v =>

              v.includes('الفئة') ||

              v.includes(

                'التصنيف'

              ) ||

              v === 'category_ar' ||

              v === 'category ar'

            );

          return (

            hasProduct &&

            hasCategory

          );

        });

      if (headerIndex === -1) {

        throw new Error(

          'لم أستطع العثور على صف عناوين الأعمدة داخل ملف Excel'

        );

      }

      const headers =

        rows[headerIndex]

          .map(v =>

            String(v ?? '')

              .trim()

          );

      const excelImages = await extractExcelImages(file, excelImageColumn(headers));

      /*
       * مهم جداً:
       * نحافظ على رقم صف Excel الحقيقي حتى نربطه بالصورة الصحيحة.
       * headerIndex يبدأ من صفر، وأرقام صفوف Excel تبدأ من 1.
       */

      const raw =

        rows

          .slice(

            headerIndex + 1

          )

          .map(

            (row, offset) => {

              const obj = {};

              headers.forEach(

                (header, i) => {

                  if (header) {

                    obj[header] =

                      row[i] ?? '';

                  }

                }

              );

              return {

                data: obj,
// مثال:// إذا Header في Excel هو الصف 4// أول منتج سيكون الصف 5.
                excelRowNumber:

                  headerIndex +

                  offset +

                  2

              };

            }

          )

          .filter(entry => {

            const row =

              entry.data;

            const categoryAr =

              cell(

                row,

                'category_ar'

              );

            const titleAr =

              cell(

                row,

                'title_ar'

              );

            const titleEn =

              cell(

                row,

                'title_en'

              );

            const titleHe =

              cell(

                row,

                'title_he'

              );

            return (

              categoryAr ||

              titleAr ||

              titleEn ||

              titleHe

            );

          });

      if (!raw.length) {

        throw new Error(

          'لم يتم العثور على أصناف بعد صف العناوين'

        );

      }

      if (raw.length > 500) {

        throw new Error(

          'الحد الأقصى 500 صف في كل عملية استيراد'

        );

      }

      importRows =

        raw

          .map(entry =>

            normalizeImportRow(

              entry.data,

              entry.excelRowNumber

            )

          )

          .filter(r =>

            Object

              .keys(

                COLUMN_ALIASES

              )

              .some(k => r[k])

          );

      if (!importRows.length) {

        throw new Error(

          'لم يتم العثور على بيانات منتجات متوافقة مع أعمدة الاستيراد'

        );

      }
// ======================================// ربط كل منتج بصورة صفه الحقيقي// ======================================
      importRows.forEach(row => {

        row.image =

          excelImages.get(

            row.rowNumber

          ) || null;

        if (!row.image) {
          // Images are optional, as in the manual product form and API.
          return;

        }

        if (

          row.image.file.size >

          5 * 1024 * 1024

        ) {

          row.errors.push(

            'حجم الصورة أكبر من 5MB'

          );

        }

        if (

          ![

            'image/jpeg',

            'image/png',

            'image/webp',

            'image/gif',

            'image/avif'

          ].includes(

            row.image.file.type

          )

        ) {

          row.errors.push(

            'صيغة الصورة غير مدعومة'

          );

        }

      });

      renderImportPreview();

    } catch (err) {

      clearImportImageUrls();

      importRows = [];

      $('confirmImportBtn').disabled =

        true;

      $('importSummary').style.display =

        'none';

      $('importPreview')

        .replaceChildren(

          element(

            'div',

            'import-error',

            err.message

          )

        );

    }

  }

);

// ==========================================
// إنشاء التصنيفات تلقائياً أثناء الاستيراد// ==========================================
async function ensureImportCategory(

  row,

  cache

) {

  const key =

    `${row.service_slug}\u0000${row.category_ar}`;

  if (cache.has(key)) {

    return cache.get(key);

  }

  const res =

    await apiFetch(

      `${API_BASE}/api/categories/service/${encodeURIComponent(row.service_slug)}`

    );

  const existing =

    (

      await responseRows(res)

    ).find(c =>

      c.name_ar.trim() ===

      row.category_ar.trim()

    );

  if (existing) {

    cache.set(

      key,

      existing.id

    );

    return existing.id;

  }

  const serviceId =

    serviceIdBySlug[

      row.service_slug

    ];

  if (!serviceId) {

    throw new Error(

      `Service غير موجود للصف ${row.rowNumber}`

    );

  }

  const created =

    await apiFetch(

      `${API_BASE}/api/categories`,

      {

        method: 'POST',

        headers: {

          'Content-Type':

            'application/json',

          ...authHeaders()

        },

        body: JSON.stringify({

          service_id:

            serviceId,

          name_ar:

            row.category_ar,

          name_en:

            row.category_en,

          name_he:

            row.category_he

        })

      }

    );

  const category =

    await created.json();

  cache.set(

    key,

    category.id

  );

  return category.id;

}
// ==========================================// تنفيذ الاستيراد// ==========================================
$('confirmImportBtn').onclick =

  async () => {

    if (

      !importRows.length ||

      importRows.some(

        r => r.errors.length

      )

    ) {

      return;

    }

    const btn =

      $('confirmImportBtn');

    btn.disabled = true;

    btn.textContent =

      'جاري الاستيراد...';

    const cache =

      new Map();

    let done = 0;

    try {

      for (

        const row

        of importRows

      ) {

        const categoryId =

          await ensureImportCategory(

            row,

            cache

          );

        const form =

          new FormData();

        form.append(

          'category_id',

          categoryId

        );

        form.append(

          'title_ar',

          row.title_ar

        );

        form.append(

          'title_en',

          row.title_en

        );

        form.append(

          'title_he',

          row.title_he

        );

        form.append(

          'description_ar',

          row.description_ar

        );

        form.append(

          'description_en',

          row.description_en

        );

        form.append(

          'description_he',

          row.description_he

        );
// ==================================// صورة المنتج المستخرجة من Excel// ==================================
        if (row.image?.file) {

          form.append(

            'image',

            row.image.file,

            row.image.file.name

          );

        }

        await apiFetch(

          `${API_BASE}/api/items`,

          {

            method: 'POST',

            headers:

              authHeaders(),

            body: form

          }

        );

        done++;

        $('importSummary').textContent =

          `تم استيراد ${done} من ${importRows.length}...`;

      }

      $('importExcelDialog')

        .close();

      clearImportImageUrls();

      showToast(

        `تم استيراد ${done} صنف بنجاح`

      );

      importRows = [];

      await loadCategories(

        currentServiceSlug

      );

    } catch (err) {

      $('importSummary').textContent =

        `تم استيراد ${done} صف، وتوقف الاستيراد: ${err.message}`;

      showToast(

        err.message

      );

    } finally {

      btn.disabled = false;

      btn.textContent =

        'استيراد';

    }

  };
// ==========================================// Admins management// ==========================================
$('manageAdminsBtn').onclick =

  async () => {

    try {

      await loadAdmins();

      $('newAdminEmail').value =

        '';

      $('newAdminPassword').value =

        '';

      $('adminsDialog')

        .showModal();

    } catch (err) {

      showToast(

        err.message

      );

    }

  };

async function loadAdmins() {

  const res =

    await apiFetch(

      `${API_BASE}/api/admins`,

      {

        headers:

          authHeaders()

      }

    );

  const admins =

    await responseRows(res);

  renderAdmins(

    admins

  );

}

function renderAdmins(admins) {

  const list =

    $('adminsList');

  list.replaceChildren();

  const currentEmail =

    localStorage.getItem(

      EMAIL_KEY

    );

  if (!admins.length) {

    list.append(

      element(

        'div',

        'empty-state',

        'ما في أدمنز'

      )

    );

    return;

  }

  admins.forEach(admin => {

    const row =

      element(

        'div',

        'admin-row'

      );

    const info =

      document.createElement(

        'div'

      );

    const email =

      element(

        'span',

        '',

        admin.email

      );

    info.append(

      email

    );

    if (

      admin.email ===

      currentEmail

    ) {

      info.append(

        element(

          'span',

          'you-tag',

          'أنتِ'

        )

      );

    }

    row.append(

      info

    );

    if (

      admin.email !==

      currentEmail

    ) {

      const remove =

        element(

          'button',

          'btn btn-danger btn-sm',

          'حذف'

        );

      remove.onclick =

        () =>

          deleteAdmin(

            admin.id

          );

      row.append(

        remove

      );

    }

    list.append(

      row

    );

  });

}

$('addAdminBtn').onclick =

  async () => {

    const email =

      $('newAdminEmail')

        .value

        .trim();

    const password =

      $('newAdminPassword')

        .value;

    if (

      !email ||

      !password

    ) {

      showToast(

        'لازم تعبي الإيميل والباسورد'

      );

      return;

    }

    if (

      password.length < 15 ||

      password.length > 128

    ) {

      showToast(

        'الباسورد لازم يكون بين 15 و128 خانة'

      );

      return;

    }

    try {

      await apiFetch(

        `${API_BASE}/api/admins`,

        {

          method: 'POST',

          headers: {

            'Content-Type':

              'application/json',

            ...authHeaders()

          },

          body:

            JSON.stringify({

              email,

              password

            })

        }

      );

      $('newAdminEmail').value =

        '';

      $('newAdminPassword').value =

        '';

      showToast(

        'تمت إضافة الأدمن'

      );

      await loadAdmins();

    } catch (err) {

      showToast(

        err.message

      );

    }

  };

async function deleteAdmin(id) {

  if (

    !confirm(

      'متأكدة بدك تحذفي هاد الأدمن؟'

    )

  ) {

    return;

  }

  try {

    await apiFetch(

      `${API_BASE}/api/admins/${id}`,

      {

        method: 'DELETE',

        headers:

          authHeaders()

      }

    );

    showToast(

      'تم حذف الأدمن'

    );

    await loadAdmins();

  } catch (err) {

    showToast(

      err.message

    );

  }

}
// ==========================================// Change password// ==========================================
$('changePasswordBtn').onclick =

  () => {

    $('currentPassword').value =

      '';

    $('newPassword').value =

      '';

    $('passwordDialog')

      .showModal();

  };

$('savePasswordBtn').onclick =

  async () => {

    const currentPassword =

      $('currentPassword')

        .value;

    const newPassword =

      $('newPassword')

        .value;

    if (

      !currentPassword ||

      !newPassword

    ) {

      showToast(

        'لازم تعبي كلمة المرور الحالية والجديدة'

      );

      return;

    }

    if (

      newPassword.length < 15 ||

      newPassword.length > 128

    ) {

      showToast(

        'كلمة المرور الجديدة لازم تكون بين 15 و128 خانة'

      );

      return;

    }

    try {

      await apiFetch(

        `${API_BASE}/api/auth/change-password`,

        {

          method: 'POST',

          headers: {

            'Content-Type':

              'application/json',

            ...authHeaders()

          },

          body:

            JSON.stringify({

              current_password:

                currentPassword,

              new_password:

                newPassword

            })

        }

      );

      $('passwordDialog')

        .close();

      showToast(

        'تم تغيير كلمة المرور. سجلي دخول من جديد.'

      );

      setTimeout(

        logout,

        1000

      );

    } catch (err) {

      showToast(

        err.message

      );

    }

  };
// ==========================================// Cleanup// ==========================================
window.addEventListener(

  'beforeunload',

  () => {

    clearImportImageUrls();

    if (previewUrl) {

      try {

        URL.revokeObjectURL(

          previewUrl

        );

      } catch {}

    }

  }

);
// ==========================================// Start// ==========================================
if (getToken()) {

  showDashboard();

} else {

  showLogin();

}
