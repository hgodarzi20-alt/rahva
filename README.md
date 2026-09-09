# راهــوا — سامانه اجاره خودرو · نسخه ۱

پیاده‌سازی PRD نسخه ۱ با Next.js + TypeScript + Prisma + PostgreSQL.

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

و داخلش `DATABASE_URL` را با نام کاربری خودتان اصلاح کنید. با Postgres.app معمولا:

    DATABASE_URL="postgresql://USERNAME@localhost:5432/rahva?schema=public"

که `USERNAME` نام کاربری مک شماست (با دستور `whoami` قابل مشاهده است).

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

## نکات پیاده‌سازی

**محدودیت عدم هم‌پوشانی رزرو** در سطح دیتابیس اعمال می‌شود، نه فقط در کد.
فایل `prisma/constraints.sql` را ببینید. برای آزمودنش کافی است یک رزرو تکراری
روی همان خودرو و همان بازه درج کنید؛ PostgreSQL خطای
`conflicting key value violates exclusion constraint` می‌دهد.

**گذارهای زمان‌محور** (انقضای قفل ۱۵ دقیقه‌ای و عدم مراجعه پس از ۲ ساعت)
با فراخوانی این مسیر انجام می‌شوند:

    curl -X POST localhost:3000/api/jobs/sweep

**تقویم** در نمایش شمسی است ولی انتخابگر تاریخ فعلا میلادی است. به نسخه بعد موکول شده.
