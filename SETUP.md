# تشغيل النظام — خطوات ما تبقّى

معظم الإعداد تم فعلياً على حساباتك (Supabase + Netlify). الباقي خطوات بسيطة لازم تسويها يدوياً لأنها تتطلب أسرار/موافقات ما ينفع تُمرَّر تلقائياً.

## ✅ اللي خلص فعلاً

- **Supabase**: مشروع `rime-asset-management` (region eu-central-1، Free tier) — كل الجداول، الصلاحيات (RLS)، الدوال (assemble/disassemble/deploy/retrieve/complete-task)، وviews التقارير مطبّقة.
- **Netlify**: موقع `rime-asset-management` منشأ، ومتغيرات البيئة (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) مضبوطة، والوصول العام مفعّل (بدون قفل SSO).
- **الكود**: مدفوع بفرع `claude/supabase-netlify-system-yjrkw7` بمستودعك على GitHub.
- **Edge Function**: `send-alerts` منشورة ومجدولة يومياً 6ص (توقيت السعودية) عبر `pg_cron` — بس ناقصها مفاتيح Resend (خطوة 3 تحت).

## 1. ربط Netlify بالـ GitHub (خطوة يدوية — الشبكة بهالبيئة ما توصل لـ Netlify مباشرة)

حاولت أنشر الموقع مباشرة، لكن سياسة الشبكة بهالـ sandbox تمنع الوصول لـ `api.netlify.com` و`netlify-mcp.netlify.app` تحديداً (مو مشكلة بالكود، حظر صريح من الـ egress policy). الحل الأسرع: اربط الموقع بمستودع GitHub وخلي Netlify يبني وينشر تلقائياً كل ما تعدّل الفرع.

1. افتح https://app.netlify.com/projects/rime-asset-management/configuration/deploys
2. **Link repository** → اختر GitHub → مستودع `anass612/-` → فرع `claude/supabase-netlify-system-yjrkw7` (أو `main` بعد ما تدمج الـ PR).
3. إعدادات البناء:
   - **Base directory**: `app`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist` (نسبي لـ base directory، يعني الناتج الفعلي `app/dist`)
4. احفظ → أول deploy يبدأ تلقائياً. الموقع يوصل خلال دقيقة تقريباً على `https://rime-asset-management.netlify.app`.

بعدها أي push جديد على الفرع المربوط ينشر تلقائياً.

## 2. إنشاء أول مستخدم Admin

النظام ما يعطي أي صلاحية افتراضية — أي مستخدم يسجّل دخول بدون سطر بجدول `profiles` يشوف رسالة "حسابك غير مفعّل".

1. Supabase Dashboard → **Authentication → Users → Add user** → أنشئ حسابك بالإيميل وكلمة مرور.
2. Supabase Dashboard → **SQL Editor** → نفّذ (بدّل القيم):
   ```sql
   insert into profiles (id, full_name, role)
   values ('USER_ID_من_الخطوة_1', 'اسمك', 'admin');
   ```
3. سجّل دخول على الموقع بنفس الإيميل/كلمة المرور. من شاشة "المهام" تقدر تنشئ حسابات فنيين لاحقاً (نفس الطريقة، بس `role = 'technician'`)، وموظفي مستودع (`role = 'warehouse_staff'`).

## 3. تفعيل التنبيهات الفعلية عبر Resend (قسم 9.5 بالمواصفة — أهم ميزة عملية)

1. أنشئ حساب مجاني على https://resend.com (الخطة المجانية كافية لـ 100 إيميل/يوم).
2. **API Keys** → أنشئ مفتاح جديد.
3. Supabase Dashboard → **Edge Functions → send-alerts → Secrets** (أو عبر CLI: `supabase secrets set`) أضف:
   | المفتاح | القيمة |
   |---|---|
   | `RESEND_API_KEY` | مفتاح Resend من الخطوة 2 |
   | `ALERT_RECIPIENT_EMAIL` | إيميلك (أو أكثر من إيميل مفصول بفواصل) |
   | `ALERT_FROM_EMAIL` | `RIME Assets <alerts@resend.dev>` مبدئياً (يشتغل بدون تحقق نطاق)، أو `alerts@yourdomain.com` بعد ما تتحقق نطاقك بـ Resend |
   | `CRON_SECRET` | `87ce7c8b0a3d70714947def45d28f456b7c11ac84a7f0768121d6f94a97b4de6` |

   **مهم:** قيمة `CRON_SECRET` هذي نفسها المخزّنة بـ `vault.secrets` بقاعدة البيانات (migration `0005_alerts_cron.sql`) — لازم تتطابق حرفياً وإلا الدالة ترفض الطلب اليومي.

4. للتجربة الفورية بدون انتظار الساعة 6 صباحاً، شغّل بـ SQL Editor:
   ```sql
   select net.http_post(
     url := 'https://pvhznqngnzpyvtdcfofh.supabase.co/functions/v1/send-alerts',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
     ),
     body := '{}'::jsonb
   );
   ```

## 4. تعبئة بيانات التشغيل الأولية

النظام فاضي حالياً (بدون بيانات وهمية). من شاشة **المخزون** بالتطبيق (كـ admin):
1. تبويب **موديلات الأجهزة** → أضف موديلات (كاميرا، NVR، gateway...).
2. تبويب **موديلات الأجهزة** → "تسجيل قطعة مُسريلة جديدة" → سجّل كل O-NA / SSD / بوابة عندك حالياً بسريالها الحقيقي من الشركة الأم.
3. تبويب **القطع (Components)** و**المستهلكات** → أضف الكيبلات/الأغطية/إلخ بكمياتها الحالية.
4. تبويب **المنتجات (BOM)** → أنشئ "الجهاز الرئيسي RES" واربط القطع المُسريلة الإلزامية (O-NA, SSD) + القطع bulk وكمياتها.
5. من شاشة **الأصول → تجميع جهاز جديد** تقدر تبدأ تجمّع أجهزة فعلية.

## 5. استيراد بيانات Airtable (لسا ما تم — قسم 5.5 بالمواصفة)

هذا يحتاج قرار "لحظة قطع" واضح منك ومعاينة فعلية لحقول Airtable الحالية (أسماء الأعمدة، تنسيق السريالات، هل فيه تكرار). لما تكون جاهز، فعّل Airtable connector بهالمحادثة (شغّال أصلاً عندك) وقلي "ابدأ استيراد Airtable" — بجهّز سكربت يقارن الحقول ويستورد دفعة وحدة، بدون ما يوقف عمل النظام الحالي.

## 6. تصميم RIME الكامل (11 شاشة) + توصية أمنية بسيطة

النظام الآن منفّذ بالكامل حسب تصميم "RIME Design System First Light v1" اللي صدّرته من Claude Design — الـ11 شاشة كلها (قائمة الأصول، سيرة الجهاز، التجميع، التفكيك، النشر/الاسترجاع الجماعي، سيرة الفرع، التنبيهات، المخزون، التقارير، الفواتير، وواجهة الفني على الموبايل)، ثنائية اللغة عربي/إنجليزي بزر تبديل بأعلى كل صفحة. الكود تحت `app/src/pages/rime/`.

توصية أمنية مجانية بسيطة من فحص Supabase الأمني: فعّل **Leaked Password Protection** من
Supabase Dashboard → Authentication → Providers → Password — يمنع المستخدمين من استخدام كلمات مرور مسرّبة معروفة (يتحقق مقابل HaveIBeenPwned)، بدون أي تكلفة أو تعقيد إضافي.

## معلومات مرجعية

- Supabase project ref: `pvhznqngnzpyvtdcfofh`
- Supabase URL: `https://pvhznqngnzpyvtdcfofh.supabase.co`
- Netlify site: `rime-asset-management` (team: `anass612`)
- الكود المحلي: `app/` (الواجهة) + `supabase/migrations/` و `supabase/functions/` (الخلفية)
