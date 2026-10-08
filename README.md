# DigiVotes

**English** | [فارسی](#فارسی)

Shows the **number of voters** next to the rating on [Digikala](https://www.digikala.com) product cards, e.g. `4.4 (256)`, so you don't have to open every product page.

> Unofficial. Not affiliated with Digikala.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/). On Chrome, also enable **Allow user scripts** for it in `chrome://extensions`.
2. Click **[DigiVotes.user.js](https://raw.githubusercontent.com/TheRay82/DigiVotes/main/DigiVotes.user.js)** to install.
3. Open any Digikala search or category page.

## Settings

Edit the constants at the top of the script:

- `REPLACE_SITE_SCORE`: `true` edits the site's score, `false` shows a separate badge
- `DEBUG`: `true` logs to the console

## Notes

Most data comes from what the page already loads; a few products may need extra requests to Digikala's API. Use at your own risk and check Digikala's terms. If Digikala changes its site and the script breaks, please open an issue.

License: [MIT](LICENSE)

---

<div dir="rtl">

# فارسی

**تعداد رای‌دهندگان** را کنار امتیاز محصولات [دیجی‌کالا](https://www.digikala.com) نشان می‌دهد، مثلاً `(۲۵۶) ۴٫۴`، تا لازم نباشد صفحه تک‌تک محصولات را باز کنید.

> غیررسمی؛ هیچ ارتباطی با دیجی‌کالا ندارد.

## نصب

1. افزونه [Tampermonkey](https://www.tampermonkey.net/) یا [Violentmonkey](https://violentmonkey.github.io/) را نصب کنید. در کروم باید گزینه **Allow user scripts** را هم در `chrome://extensions` فعال کنید.
2. روی **[DigiVotes.user.js](https://raw.githubusercontent.com/TheRay82/DigiVotes/main/DigiVotes.user.js)** بزنید و نصب کنید.
3. یک صفحه جستجو یا دسته‌بندی دیجی‌کالا را باز کنید.

## تنظیمات

ثابت‌های ابتدای فایل اسکریپت را ویرایش کنید:

- بخش `REPLACE_SITE_SCORE`: مقدار `true` امتیاز خود سایت را ویرایش می‌کند، `false` یک نشان جداگانه نشان می‌دهد
- بخش `DEBUG`: مقدار `true` لاگ را در کنسول نشان می‌دهد

## توضیحات

بیشتر داده‌ها از چیزی گرفته می‌شود که صفحه خودش بارگذاری می‌کند؛ برای تعداد کمی از محصولات ممکن است درخواست اضافه به API دیجی‌کالا ارسال شود. با مسئولیت خودتان استفاده کنید و قوانین دیجی‌کالا را بررسی کنید. اگر دیجی‌کالا سایت را تغییر دهد و اسکریپت از کار بیفتد، لطفاً یک Issue باز کنید.

مجوز: [MIT](LICENSE)

</div>
