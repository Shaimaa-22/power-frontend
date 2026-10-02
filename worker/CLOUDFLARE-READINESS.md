# تقرير التنفيذ والتحقق — 2026-09-24

تم الحفاظ على React/Vite + Pages، وHono + Workers + D1 + Static Assets + B2. لم تتم إضافة PostgreSQL أو Neon أو KV أو Durable Objects أو Queues، ولم يُفعّل R2. لا نعتبر المشروع مثبت الجاهزية للإنتاج: اختبارات B2 الحقيقية وقياس CPU واختبار المتصفح الكامل ما زالت مطلوبة.

## الملفات المتغيرة: Backend

كل المسارات التالية نسبةً إلى مجلد `power-worker`.

| FILE | CHANGES | WHY |
| --- | --- | --- |
| `public/admin.html` | استخراج JavaScript إلى modules وإضافة نافذة تغيير كلمة المرور وحدود المدخلات | تقليل HTML الديناميكي وإتاحة إبطال الجلسات من الواجهة |
| `public/admin.js` | DOM آمن بدل innerHTML، معالجة جميع HTTP failures، إصدارات العناصر، رفض نتائج الطلبات القديمة | منع XSS ورسائل النجاح الكاذبة وتضارب التحديثات |
| `public/admin-api.js` | helper موحد للطلبات، timeout، أخطاء HTTP/JSON، تسجيل خروج عند 401 | تغطية login وCRUD وuploads بنفس السلوك |
| `public/admin-dom.js` | textContent/createElement وفحص أسماء ملفات الصور | إبقاء بيانات D1 نصًا ومنع حقن روابط/HTML |
| `public/_headers` | nosniff وDENY وReferrer/Permissions وCSP محدودة وcache directives | حماية assets دون كسر inline styles/scripts الحالية |
| `src/index.js` | HTTPException، فحص الإعدادات، scheduled cleanup، export للاختبار | حالات HTTP صحيحة واستعادة أعمال التنظيف |
| `src/lib/auth.js` | D1 account/state/token_version verification لكل طلب محمي | إبطال JWT بعد الحذف/التعطيل/تغيير كلمة المرور |
| `src/lib/password.js` | فحص صيغة PBKDF2 وحدود iterations وlegacy verification وdummy hash | حماية الحسابات الحالية وضبط كلفة الاشتقاق |
| `src/lib/rate-limit.js` | binding أصلي من Cloudflare لعنوان IP والحساب | منع الاعتماد على ذاكرة isolate؛ fail closed عند غياب binding |
| `src/lib/validation.js` | حدود البريد وكلمة المرور والنصوص وIDs | رفض مدخلات غير صالحة قبل SQL/KDF |
| `src/lib/http.js` | عدّ bytes أثناء قراءة stream وحدود JSON/multipart وفحص الحقول | رفض body كبير حتى مع Content-Length كاذب/مفقود |
| `src/lib/images.js` | فحص signatures للأنواع الخمسة، UUID، حجز cleanup قبل الرفع | منع MIME spoofing البسيط واستعادة الصور اليتيمة |
| `src/lib/storage.js` | B2 timeouts وطلبات حذف متسلسلة محدودة وفحص endpoint؛ R2 اختياري | ضبط subrequests وعدم الحاجة إلى R2 binding في وضع B2 |
| `src/lib/cleanup.js` | outbox في D1 مع leases/retries و10 صور للدورة | حذف مجموعات كبيرة عبر عدة طلبات دون Promise.all غير محدود |
| `src/lib/conditional.js` | ترتيب If-Match/If-Unmodified/If-None/If-Modified | التفريق الصحيح بين 304 و412 |
| `src/routes/auth.js` | validation/throttling ورسائل عامة وتغيير كلمة المرور | حماية login وإبطال جميع الجلسات عند التغيير |
| `src/routes/admins.js` | validation وحماية آخر حساب نشط | منع حذف آخر حساب فعّال والمدخلات غير الصحيحة |
| `src/routes/items.js` | SQL parameterized وD1.batch وversion checks وحجز رفع الصور | اتساق metadata مع عمليات التخزين ومقاومة التعديلات المتزامنة |
| `src/routes/categories.js` | validation وحالات 404/409 وحذف يعتمد FK/outbox | حذف ذري دون تحميل جميع الصور أو تجاوز subrequests |
| `src/routes/images.js` | cache key موحد وmax-age=300 وconditional requests | منع 304 الخاطئة وتقليل الصور القديمة بعد التعديل/الحذف |
| `migrations/0001_security_and_cleanup.sql` | حقول session state وitem version/storage، triggers، outbox/indexes | تحديث schema دون تغيير migration سابقة أو schema.sql الأصلية |
| `scripts/seed-admin.mjs` | إدخال مخفي وتأكيد وسياسة كلمة المرور وفحص iterations وSQL مؤقت | منع كلمة المرور في command history وإعطاء أخطاء واضحة |
| `wrangler.jsonc` | D1 migrations_dir وrate-limit binding وcron وPBKDF2 variable | تشغيل الإصلاحات مع نفس الموارد الحالية ودون secrets |
| `.dev.vars.example` | أسماء secrets فقط مع تعليقات إعداد محلي | منع نشر قيم حساسة |
| `.gitignore` | تجاهل env/dev.vars وSQL المؤقت ومخرجات الاختبارات | تقليل تسريب بيانات حساسة |
| `.node-version` | Node 22 | توحيد بيئة build |
| `package.json` | scripts اختبارات/migrations/dry-run وNode >=22.13 | تكرار التحقق بوضوح |
| `package-lock.json` | مزامنة engines فقط | إبقاء dependencies المثبتة دون ترقية عشوائية |
| `tests/helpers.mjs` | D1 adapter محلي وfixtures | اختبارات SQL ومعاملات على SQLite حقيقية |
| `tests/security.test.mjs` | login/JWT/authorization/hash/reset/rate tests | تغطية الأجزاء الأمنية الحرجة |
| `tests/uploads.test.mjs` | streamed limits وsignatures وuploads/outbox/migration/cache/R2 | تغطية الرفع والحذف وتوافق migrations |
| `tests/admin-ui.test.mjs` | API error statuses وsafe DOM | منع عودة XSS/false success |
| `tests/runtime.test.mjs` | workerd + D1 + native limiter + assets + B2 mock | التحقق من runtime الفعلي محليًا دون خدمة إنتاج |
| `README.md` | إعداد محلي وmigration وenv وحدود الحماية | استبدال التعليمات القديمة غير المطابقة |
| `wrangler.preview.jsonc` | Worker/D1 منفصلان دون B2 credentials | نشر تجريبي بعد الإذن اللاحق |
| `scripts/smoke-preview.mjs` | secret عشوائي وحساب مؤقت واختبارات HTTP فعلية، ثم حذف الحساب | اختبار auth على التجربة دون طباعة passwords/JWTs |
| `CLOUDFLARE-READINESS.md` | هذا التقرير | سجل تغييرات وتحقق ومهام متبقية |

## الملفات المتغيرة: Frontend

كل المسارات التالية نسبةً إلى مجلد `power-frontend`.

| FILE | CHANGES | WHY |
| --- | --- | --- |
| `src/api/client.js` | تركيب API client من إعداد Vite | إزالة localhost الافتراضي من production |
| `src/api/base.js` | localhost:8787 في development وفحص HTTPS origin في production | منع /api المكرر والإعداد الخاطئ |
| `src/api/http-client.js` | فحص HTTP/JSON/list shapes وtimeout/abort | أخطاء واضحة بدل فشل عرض صامت |
| `src/api/service-content.js` | تحميل جزئي وتزامن حتى 3 طلبات | الاحتفاظ بالنتائج الناجحة عند فشل جزء |
| `src/hooks/useServiceContent.js` | حالات loading/ready/error/partial وإلغاء الطلبات القديمة | منع سباق navigation وتوضيح الحالة |
| `src/pages/ServiceDetail.jsx` | رسائل فشل جزئي مستقلة عن empty state | عدم إخفاء بيانات سليمة بسبب طلب واحد |
| `src/components/ItemImage.jsx` | إعادة حالة الخطأ عند تغيّر filename | ظهور الصورة الجديدة بعد update |
| `src/lib/url.js` | decode آمن | URI غير صالح لا يسقط التطبيق |
| `src/router.jsx` | استعمال decoder آمن | حماية hash/route parameters |
| `src/i18n/ar.json` | نصوص فشل جزئي بالعربية | دعم UX الحالي |
| `src/i18n/en.json` | نصوص فشل جزئي بالإنجليزية | دعم UX الحالي |
| `src/i18n/he.json` | نصوص فشل جزئي بالعبرية | دعم UX الحالي |
| `vite.config.js` | فحص VITE_API_URL وقت build | فشل مبكر بدل نشر bundle بوجهة خاطئة |
| `.env.example` | VITE_API_URL فارغ وتعليقات واضحة | توثيق public variable دون أسرار |
| `.gitignore` | تجاهل env وملفات الأدوات | منع commit غير مقصود |
| `.node-version` | Node 22 | إعداد Pages build |
| `package.json` | test script وNode engine | اختبارات خفيفة دون framework جديد |
| `package-lock.json` | engines root | مزامنة package metadata |
| `tests/api.test.mjs` | URLs/errors/partial/abort/router/SPA tests | التحقق من نقاط الفشل الأساسية |
| `README.md` | build/env/Pages وتعريف artifact التجريبي | تعليمات مطابقة للكود |

`public/_redirects` محفوظ دون تعديل. `schema.sql` محفوظ دون تعديل. لا توجد إعادة كتابة للتقنيات أو انتقال للتخزين.

## الاختبارات المحلية المنفذة

| الأمر | النتيجة |
| --- | --- |
| Frontend: `npm ci` | نجاح |
| Backend: `npm ci` | نجاح |
| Frontend: `npm test` | 6/6 نجاح |
| Backend: `npm test` | 16/16 نجاح، يتضمن workerd فعليًا محليًا |
| Frontend: `npm run build` مع HTTPS test origin | نجاح، 89 modules |
| Frontend: `npm run build` مع Worker التجريبي الفعلي | نجاح، 89 modules؛ dist الحالي موجّه للتجربة |
| Backend: `npx wrangler deploy --dry-run` | نجاح، 127.20 KiB / gzip 31.67 KiB؛ لا R2 binding |
| Frontend: `git diff --check` | نجاح؛ تحذيرات line endings فقط |

تعذر esbuild/workerd أولًا بسبب قيود sandbox؛ إعادة التنفيذ المصرّح بها خارجها نجحت. أخطاء B2 500 في اختبار retry مقصودة ومحاكاة، وليست أخطاء إنتاج. تحذيرات install scripts لم تمنع التشغيل الفعلي. Backend ليس Git repository محليًا، لذلك لا يمكن الادعاء بتدقيق tracked files فيه؛ لم توجد ملفات أسرار فعلية عند الفحص، وأضيفت قواعد تجاهل للمستقبل. Frontend لم يتتبع ملف أسرار فعليًا.

## النشر التجريبي بعد الإذن اللاحق

- Worker: `power-preview-20260924` — https://power-preview-20260924.power-elec.workers.dev
- الإدارة: https://power-preview-20260924.power-elec.workers.dev/admin
- D1: `power-preview-20260924-db` — `1f81c155-7bf6-4efa-8918-ac3311d40528`، قاعدة تجريبية جديدة، baseline ثم migration نجحت فعليًا.
- Pages: `power-preview-20260924`، الفرع التجريبي `audit` — https://audit.power-preview-20260924.pages.dev
- نسخة Pages: https://007a12de.power-preview-20260924.pages.dev
- لا يوجد B2 key/bucket في preview، لذلك رفع/عرض الصور من التخزين الحقيقي غير متاح. القاعدة تحتوي الخدمات الأربع الأساسية فقط، وحُذف حساب الاختبار المؤقت.
- تم توليد JWT_SECRET مستقل عشوائي وتمريره إلى Cloudflare Secrets عبر stdin دون طباعته أو حفظه في Git.

الأوامر: `wrangler whoami`؛ `wrangler d1 create power-preview-20260924-db`؛ `wrangler d1 execute power-preview-20260924-db --remote --config wrangler.preview.jsonc --file schema.sql`؛ `wrangler d1 migrations apply power-preview-20260924-db --remote --config wrangler.preview.jsonc`؛ `wrangler deploy --config wrangler.preview.jsonc`؛ `node scripts/smoke-preview.mjs`؛ إنشاء Pages الصريح باستخدام `pages project create power-preview-20260924 --production-branch main --force`؛ ثم `pages deploy dist --project-name power-preview-20260924 --branch audit --commit-dirty=true`.

نجح smoke الفعلي: admin assets 200 وnosniff، services 200، protected request بدون JWT =401، login =200، protected request =200، password change =200، JWT القديم =401، login بكلمة جديدة =200، حذف الحساب ثم JWT الجديد =401. نجح CORS للـPages origin. هذا لا يقيس استهلاك CPU تحت حمل ولا يختبر B2.

ظهر TLS handshake failure فور إنشاء Pages؛ بعد الانتظار نجح الفحص النهائي عبر HTTPS للنسخة المنشورة: `/` و`/contact` و`/services/solar-energy` جميعها 200 مع مستند SPA الصحيح. هذا تحقق HTTP للـrefresh fallback، وليس اختبار تفاعل شامل داخل متصفح.

### حادثة تحويل CLI وإصلاحها

أمر `pages project create` الأول في Wrangler 4.135.0 حوّل تلقائيًا العملية إلى Workers واستخدم config مجلد Backend الافتراضي. نشر ذلك نسخة على **Worker التجريبي** مرتبطة مؤقتًا بـ`power-db` وإعدادات B2 غير السرية. لم يُنشر إلى Worker الإنتاج `power-api`. أُعيد فورًا نشر config التجربة؛ النسخة المصححة `0415f27b-d245-4b7a-bb50-13668f29cbb8` مرتبطة بـD1 التجريبية فقط ودون إعدادات B2. لا توجد B2 secrets في Worker التجربة.

استعلام قراءة فقط إلى `sqlite_master` في `power-db` أكّد غياب جدول `image_cleanup` و`rows_written=0`، فلا يستطيع cron الجديد تنفيذ cleanup عبر هذه القاعدة. لم نطبّق schema/migration أو عملية كتابة مقصودة على قاعدة الإنتاج. استُخدم بعد ذلك خيار Pages الصريح `--force` لمنع التحويل، بما يحافظ على architecture المطلوبة. هذه واقعة مهمة وليست نجاحًا يُخفى خلف رسالة CLI.

## التوافق والحدود المتبقية

| الجزء | ما ثبت | ما لم يثبت |
| --- | --- | --- |
| Pages | build ونشر Pages وHTTPS وSPA fallback لثلاثة مسارات فعلية | اختبار متصفح تفاعلي شامل وبقية routes |
| Worker | dry-run ونشر منفصل وauth smoke فعلي | CPU تحت حمل وحدود الخطة الحالية وكامل UI E2E |
| D1 | migration على SQLite/workerd وعلى D1 تجريبية فعلية | تطبيق migration على البيانات الإنتاجية بعد backup |
| B2 | اختبارات upload/delete/cleanup بمحاكاة signed fetch | صلاحية المفاتيح/المنطقة/permissions/رفع وحذف فعلي؛ لم تُستخدم credentials إنتاج |
| R2 | optional path واختبار batching؛ غير مطلوب لـbuild | لم يُفعّل أو يُنقل إليه أي ملف |

- PBKDF2 100000 ضمن حد workerd واختُبر، لكنه أقل من توصية OWASP لـPBKDF2-SHA256؛ يحتاج تقييم CPU والخطة، ولا نخفي الفرق. Hashes القديمة محفوظة وتترقى بتغيير/إعادة ضبط كلمة المرور.
- Rate limiting أصلي لكنه per-location/eventually consistent، وليس حدًا عالميًا صارمًا.
- فحص الصور signatures محدود وليس decoder كاملًا. JWT باقٍ في localStorage كما في النظام الحالي؛ إصلاح DOM لا يساوي حماية من كل browser compromise.
- Cache purge محلي وTTL خمس دقائق؛ لا ضمان لحذف فوري من كل browser/edge، وB2 cleanup مؤجل قابل لإعادة المحاولة.
- تحتاج Cron مراقبة backlog وأخطاء retries؛ لا توجد خدمة background خارج Worker.
- لا يوجد role model جديد؛ جميع حسابات admin لها الصلاحيات القائمة نفسها.

## Checklist داخل Cloudflare Dashboard فقط

قبل نشر الإنتاج لاحقًا:

- [ ] افتح الحساب الصحيح وافحص Worker `power-api` وD1 `power-db` وربط `DB` بمعرف القاعدة الموجودة؛ لا تنشئ بديلًا لها.
- [ ] من D1 أنشئ/تحقق من نقطة استعادة أو export قبل migration. افحص الأعمدة لتتأكد أن migration لم تُطبق سابقًا.
- [ ] طبّق `0001_security_and_cleanup.sql` مرة واحدة من D1 Console. لا تطبق baseline على قاعدة الإنتاج الحالية. نفّذ كل SQL statement كاملًا، بما فيه جسم trigger. إذا تعطل جزء، افحص الحالة قبل إعادة ALTER، فالملف ليس معدًا لإعادة تطبيقه عشوائيًا.
- [ ] إذا استُخدمت Console بدل Wrangler migrations، سجّل اسم migration في `d1_migrations` بعد نجاح **كل** الجمل فقط، حتى لا يعيد Wrangler تطبيقها لاحقًا. صيغة الجدول/التسجيل أدناه.
- [ ] في Worker Settings > Variables and Secrets: أضف JWT_SECRET عشوائيًا مستقلًا ≥32 حرفًا، وB2_KEY_ID وB2_APPLICATION_KEY كـSecrets؛ اضبط B2_ENDPOINT/REGION/BUCKET_NAME وSTORAGE_DRIVER=b2 وPBKDF2_ITERATIONS=100000 كمتغيرات.
- [ ] تحقق من أن مفاتيح B2 المقيدة مُحضرة مسبقًا؛ Cloudflare Dashboard لا يمكنه إنشاء أو تدقيق صلاحيات حساب Backblaze نيابةً عنه.
- [ ] عند إعداد Git Builds للـWorker، استخدم إعداد المشروع وwrangler.jsonc الحاليين؛ لا تعِد استخدام wrangler.preview.jsonc للإنتاج. rate-limit binding يأتي من config وقد لا يظهر كعنصر قابل للتحرير في Dashboard.
- [ ] تحقق من Scheduled Triggers: كل خمس دقائق. راقب أخطاء cleanup والـbacklog في D1.
- [ ] تحقق من الخطة وCPU metrics تحت اختبارات login/reset؛ نجاح طلب تجريبي واحد ليس اختبار حمل.
- [ ] في Pages الإنتاجية: اختر مشروع Frontend، build=`npm run build`، output=`dist`، Node=22، وVITE_API_URL=HTTPS origin الفعلي للـWorker دون `/api`. اضبط Preview وProduction كلًا على حدة، ثم أعد build.
- [ ] لا تستخدم dist الحالي للإنتاج: هو موجّه لـWorker التجريبي.
- [ ] بعد النشر المصرّح به لاحقًا اختبر refresh في `/` و`/contact` و`/services/...`، ثم admin login/create/update/delete/password، ورفع/حذف الأنواع الخمسة على bucket اختبار قبل الإنتاج.
- [ ] راقب 401/429/5xx وD1 errors وCPU وB2 errors؛ لا تعلن الجاهزية قبل نجاح الفحوص.

تسجيل migration اليدوية، **بعد نجاح تطبيقها فقط**:

```sql
CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO d1_migrations(name) VALUES ('0001_security_and_cleanup.sql');
```

لحذف التجربة من Dashboard بعد الانتهاء: احذف مشروع Pages `power-preview-20260924`، ثم Worker بنفس الاسم (بما فيه Cron)، ثم D1 `power-preview-20260924-db`. لا تحذف `power-api` أو `power-db`، ولا يلزم حذف شيء من B2 لأن التجربة لم ترفع إليه صورًا.

مراجع: [Cloudflare rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)، [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)، [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)، [Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/).
