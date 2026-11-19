# Rahva — Car Rental Management System

> **Course project** · Product & build: Hoda Goodarzi · Built with Claude Code

**English summary**
Rahva is a car rental platform that covers the full rental lifecycle — from search and booking to vehicle return — plus an incident flow for accidents and damage. I wrote the PRD, broke it into epics, and built the product end to end using **Claude Code** as an AI pair-programmer, making the product and logic decisions myself.

- **3 user roles:** customer, operator (branch staff), fleet manager
- **Booking:** search, driver details, 15-minute reservation lock, double-booking prevention enforced at the database level
- **Incident management:** on-site incident report, documents & police sketch, damage assessment, invoice, tenant acceptance or dispute, settlement from the deposit
- **Manager tools:** fleet management, dispute handling, metrics dashboard
- **Quality:** 26 automated tests on the financial logic (deposit settlement)
- **Stack:** Next.js 14, TypeScript, Prisma, PostgreSQL

---

## معرفی محصول

**راهوا** یک سامانه‌ی اجاره‌ی خودرو است که کل چرخه‌ی اجاره را پوشش می‌دهد: از جست‌وجو و رزرو تا تحویل و بازگرداندن خودرو. علاوه بر این، جریان کامل رسیدگی به حادثه و خسارت را هم دارد.

**نقش من:** نوشتن PRD، تقسیم آن به اپیک‌ها، تصمیم‌گیری درباره‌ی منطق محصول و ساخت کامل آن با **Claude Code**. این پروژه، پروژه‌ی پایانی یک دوره‌ی آموزشی است.

### نقش‌های کاربری
| نقش | کارهای اصلی |
|---|---|
| مشتری | جست‌وجو و رزرو خودرو، پیگیری رزروها، ثبت حادثه و پیگیری پرونده |
| اپراتور شعبه | مدیریت تحویل و بازگشت خودرو، بررسی پرونده‌های حادثه، برآورد خسارت و صدور صورت‌حساب |
| مدیر ناوگان | مدیریت خودروها، رسیدگی به اعتراض‌ها، داشبورد شاخص‌ها |

### تصمیم‌های محصولی کلیدی
- **جلوگیری از رزرو هم‌پوشان در سطح دیتابیس**، نه فقط در کد، تا دو مشتری هیچ‌وقت یک خودرو را برای یک بازه رزرو نکنند.
- **قفل ۱۵ دقیقه‌ای رزرو** تا مشتری فرصت پرداخت داشته باشد و خودرو بی‌دلیل قفل نماند.
- **تسویه‌ی ودیعه با سه حالت:** بازگشت کامل، کسر بخشی، و ضبط کامل همراه با ثبت بدهی مازاد.
- **تسویه بر مبنای برآورد کارشناسی** تا پرونده سریع بسته شود؛ تطبیق با فاکتور نهایی تعمیرگاه عمداً خارج از دامنه‌ی این نسخه است.

<!-- TODO: add screenshots to docs/screenshots and uncomment
### تصاویر
![صفحه‌ی جست‌وجو](docs/screenshots/search.png)
![پنل اپراتور](docs/screenshots/staff.png)
![داشبورد مدیر](docs/screenshots/manager.png)
-->

<!-- TODO: add docs/PRD.pdf and uncomment
### مستندات
- [PRD محصول](docs/PRD.pdf)
-->

---

## راه‌اندازی برای توسعه‌دهنده‌ها · نسخه ۲

پیاده‌سازی PRD نسخه ۲ با Next.js ۱۴ + TypeScript + Prisma + PostgreSQL.

نسخه ۱ چرخه رزرو تا بازگشت خودرو را پوشش می‌داد. نسخه ۲ مدیریت حادثه را اضافه می‌کند:
ثبت حادثه در صحنه، تکمیل مستندات و کروکی، بازرسی و برآورد کارشناسی خسارت،
صدور صورت‌حساب، پذیرش یا اعتراض مستأجر، و تسویه از محل ودیعه.

## پیش‌نیاز

PostgreSQL باید نصب و در حال اجرا باشد.
ساده‌ترین راه روی مک: Postgres.app از postgresapp.com — دانلود، انتقال به Applications، باز کردن، Initialize.

اگر دستور `createdb` شناخته نشد، مسیرش را اضافه کنید:

    echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp

سپس ترمینال را ببندید و دوباره باز کنید.

## راه‌اندازی

    npm install
    createdb rahva

فایل `.env` را بسازید:

    cp .env.example .env

سه چیز را داخلش تنظیم کنید:

**۱. اتصال دیتابیس.** با Postgres.app معمولا:

    DATABASE_URL="postgresql://USERNAME@localhost:5432/rahva?schema=public"

که `USERNAME` نام کاربری مک شماست (با دستور `whoami` قابل مشاهده است).

**۲. کلیدهای رمزنگاری.** کد ملی و شماره گواهینامه رمزنگاری‌شده ذخیره می‌شوند،
پس این دو کلید الزامی‌اند و بدونشان برنامه هنگام ثبت رزرو خطا می‌دهد.
هرکدام باید ۳۲ بایت و base64 باشند. برای ساختن هرکدام یک بار این را اجرا کنید:

    openssl rand -base64 32

و خروجی را در `RAHVA_HMAC_KEY` و `RAHVA_ENC_KEY` بگذارید.

**۳. کلید نشست.** مقدار پیش‌فرض `SESSION_SECRET` برای اجرای محلی کافی است.

سپس:

    npx prisma migrate dev --name init
    npm run db:constraint
    npm run db:seed
    npm run dev

سایت روی http://localhost:3000 بالا می‌آید.

## حساب‌های آزمایشی

رمز همه: `password123`

| نقش | شماره موبایل | مسیر |
|---|---|---|
| مشتری | 09121000000 | / |
| اپراتور | 09120000001 | /staff |
| مدیر ناوگان | 09120000002 | /manager |

داده اولیه شامل چند رزرو فعال و چند پرونده حادثه در وضعیت‌های مختلف است،
تا بتوان جریان بازرسی، صدور صورت‌حساب و تسویه را بدون ساختن داده جدید دید.

## آزمون

    npm run test        # تست‌های واحد منطق مالی
    npm run typecheck   # بررسی نوع‌ها

## نکات پیاده‌سازی

**محدودیت عدم هم‌پوشانی رزرو** در سطح دیتابیس اعمال می‌شود، نه فقط در کد.
فایل `prisma/constraints.sql` را ببینید. برای آزمودنش کافی است یک رزرو تکراری
روی همان خودرو و همان بازه درج کنید؛ PostgreSQL خطای
`conflicting key value violates exclusion constraint` می‌دهد.

**گذارهای زمان‌محور** (انقضای قفل ۱۵ دقیقه‌ای و عدم مراجعه پس از ۲ ساعت)
با فراخوانی این مسیر انجام می‌شوند:

    curl -X POST localhost:3000/api/jobs/sweep

**وضعیت کروکی محور مستقلی از وضعیت پرونده است.** پرونده می‌تواند همزمان
`under_assessment` باشد و منتظر دریافت نسخه کروکی. این تفکیک عمدی است.

**پیامک‌ها شبیه‌سازی‌شده‌اند** و به‌جای ارسال واقعی، در جدول `NotificationLog`
ثبت می‌شوند. سه پیامک در این نسخه: ثبت پرونده، صدور برآورد، و تسویه.

**تقویم** در نمایش شمسی است ولی انتخابگر تاریخ تولد و انقضای گواهینامه
فعلا میلادی است. به نسخه بعد موکول شده.
