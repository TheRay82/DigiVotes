# DigiVotes

**English** | [فارسی](#فارسی)

Adds two things to [Digikala](https://www.digikala.com) listing pages:

- **Voter counts on product cards**, next to the rating, e.g. `4.4 (256)`, so you don't have to open every product page.
- **Sort by number of votes**, which Digikala doesn't offer. A button in the sort bar ranks the results from most votes to fewest.

> Unofficial. Not affiliated with Digikala.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/). On Chrome, also enable **Allow user scripts** for it in `chrome://extensions`.
2. Click **[DigiVotes.user.js](https://raw.githubusercontent.com/TheRay82/DigiVotes/main/DigiVotes.user.js)** to install.
3. Open any Digikala search, category or tag page (`/search/...`, `/search/category-.../`, `/tags/<tag>/`).

## Sort by votes

Digikala has no vote-count sort, so the script fetches the listing pages itself, reads each product's vote count and ranks them locally.

- **Open it** with the indigo **بیشترین رای** pill at the end of Digikala's sort bar, or press **Alt+S**.
- **Ranking:** most votes first, with rank, thumbnail, vote count, score, price, discount and an out-of-stock label for each product. Click a row to open the product in a new tab.
- **Search box:** type to filter the ranked list by title. The ranks are renumbered within the filtered list. It matches every word you type, ignores Arabic/Persian letter variants, half-spaces and digit styles, and doesn't send any requests. Press **Esc** once to clear it and again to close the panel.
- **Settings** (the *تنظیمات* button in the panel):
  - **Number of pages** to scan (20 products per page). Limits: 50 for searches, 100 for categories, up to 200 for tags (a scan never goes past the last page that exists).
  - **Hide unrated products** (on by default).
  - **Minimum votes** filter. It is off every time the page loads, so the list is never silently emptied.
- **Stop** cancels a scan at any time. Closing the panel or leaving the page also cancels it.

### What to know

- It only ranks the pages it scanned. The panel says how many of the category's products that covered, so a big category with a low page count is a partial ranking. More pages means better coverage but more time and data.
- Each page is a few hundred KB, so a large scan makes many requests to Digikala. Pages are fetched two at a time, kept for 10 minutes (up to 200 pages) so repeat scans are fast, and a request that takes over 20 seconds counts as failed and is retried. If four pages fail in a row (for example if Digikala is throttling you), the scan stops and keeps what it already has.
- The button is added to Digikala's sort bar by recognising its sort labels. If the layout is different (for example on mobile) or Digikala changes it, the button may not appear; **Alt+S** still works on desktop.

## Settings

Edit the constants at the top of the script:

- `REPLACE_SITE_SCORE`: `true` edits the site's score, `false` shows a separate badge
- `DEBUG`: `true` logs to the console

## Notes

Voter counts on cards mostly come from data the page already loads; a few products may need extra requests to Digikala's API. The sort feature makes its own requests as described above. Use at your own risk and check Digikala's terms. If Digikala changes its site and the script breaks, please open an issue.

License: [MIT](LICENSE)

---

<div dir="rtl">

# فارسی

دو قابلیت به صفحه‌های لیست [دیجی‌کالا](https://www.digikala.com) اضافه می‌کند:

- **تعداد رای‌دهندگان** را کنار امتیاز محصولات نشان می‌دهد، مثلاً `(۲۵۶) ۴٫۴`، تا لازم نباشد صفحه تک‌تک محصولات را باز کنید.
- **مرتب‌سازی بر اساس تعداد رای**، که دیجی‌کالا ندارد. یک دکمه در نوار مرتب‌سازی، نتایج را از بیشترین رای به کمترین مرتب می‌کند.

> غیررسمی؛ هیچ ارتباطی با دیجی‌کالا ندارد.

## نصب

1. افزونه [Tampermonkey](https://www.tampermonkey.net/) یا [Violentmonkey](https://violentmonkey.github.io/) را نصب کنید. در کروم باید گزینه **Allow user scripts** را هم در `chrome://extensions` فعال کنید.
2. روی **[DigiVotes.user.js](https://raw.githubusercontent.com/TheRay82/DigiVotes/main/DigiVotes.user.js)** بزنید و نصب کنید.
3. یک صفحه جستجو، دسته‌بندی یا برچسب دیجی‌کالا را باز کنید (`/search/...`، `/search/category-.../`، `/tags/<tag>/`).

## مرتب‌سازی بر اساس رای

دیجی‌کالا مرتب‌سازی بر اساس تعداد رای را ندارد؛ پس اسکریپت خودش صفحه‌های لیست را می‌گیرد، تعداد رای هر محصول را می‌خواند و لیست را روی همان دستگاه رتبه‌بندی می‌کند.

- **باز کردن:** دکمه بنفش‌آبی **بیشترین رای** در انتهای نوار مرتب‌سازی دیجی‌کالا، یا کلید **Alt+S**.
- **رتبه‌بندی:** از بیشترین رای به کمترین، همراه با رتبه، تصویر، تعداد رای، امتیاز، قیمت، تخفیف و برچسب ناموجود برای هر محصول. با کلیک روی هر ردیف، محصول در تب جدید باز می‌شود.
- **جستجو در نتایج:** با تایپ کردن، لیست رتبه‌بندی‌شده بر اساس عنوان فیلتر می‌شود و رتبه‌ها در همان لیست فیلترشده دوباره شماره‌گذاری می‌شوند. همه کلمه‌هایی که تایپ می‌کنید باید در عنوان باشند؛ تفاوت حروف عربی و فارسی، نیم‌فاصله و نوع رقم‌ها مهم نیست و هیچ درخواستی ارسال نمی‌شود. یک‌بار **Esc** کادر جستجو را پاک می‌کند و بار دوم پنجره را می‌بندد.
- **تنظیمات** (دکمه *تنظیمات* در پنجره):
  - **تعداد صفحه** برای بررسی (هر صفحه ۲۰ کالا). حداکثر: ۵۰ برای جستجو، ۱۰۰ برای دسته‌بندی و تا ۲۰۰ برای برچسب (اسکریپت هیچ‌وقت از آخرین صفحه موجود جلوتر نمی‌رود).
  - **حذف کالاهای بدون رای** (به‌طور پیش‌فرض روشن).
  - فیلتر **حداقل رای**. با هر بار باز شدن صفحه خاموش است تا لیست بی‌صدا خالی نشود.
- دکمه **توقف** هر زمان بررسی را متوقف می‌کند. بستن پنجره یا رفتن به صفحه دیگر هم آن را متوقف می‌کند.

### نکته‌ها

- فقط صفحه‌هایی که بررسی شده‌اند رتبه‌بندی می‌شوند. پنجره نشان می‌دهد این بررسی چند کالا از کل دسته را پوشش داده؛ پس در دسته‌های بزرگ با تعداد صفحه کم، رتبه‌بندی ناقص است. صفحه بیشتر یعنی پوشش بهتر ولی زمان و داده بیشتر.
- هر صفحه چند صد کیلوبایت است، پس یک بررسی بزرگ درخواست‌های زیادی به دیجی‌کالا می‌فرستد. صفحه‌ها دوتا‌دوتا گرفته می‌شوند، ۱۰ دقیقه نگه داشته می‌شوند (تا ۲۰۰ صفحه) تا بررسی دوباره سریع باشد، و درخواستی که بیش از ۲۰ ثانیه طول بکشد ناموفق حساب شده و دوباره امتحان می‌شود. اگر چهار صفحه پشت سر هم ناموفق باشند (مثلاً وقتی دیجی‌کالا شما را محدود می‌کند)، بررسی متوقف می‌شود و آنچه تا آن لحظه جمع شده را نگه می‌دارد.
- دکمه با شناسایی عنوان گزینه‌های مرتب‌سازی به نوار دیجی‌کالا اضافه می‌شود. اگر چیدمان فرق داشته باشد (مثلاً در موبایل) یا دیجی‌کالا آن را عوض کند، ممکن است دکمه ظاهر نشود؛ کلید **Alt+S** روی دسکتاپ همچنان کار می‌کند.

## تنظیمات

ثابت‌های ابتدای فایل اسکریپت را ویرایش کنید:

- بخش `REPLACE_SITE_SCORE`: مقدار `true` امتیاز خود سایت را ویرایش می‌کند، `false` یک نشان جداگانه نشان می‌دهد
- بخش `DEBUG`: مقدار `true` لاگ را در کنسول نشان می‌دهد

## توضیحات

تعداد رای روی کارت‌ها بیشتر از داده‌ای گرفته می‌شود که صفحه خودش بارگذاری می‌کند؛ برای تعداد کمی از محصولات ممکن است درخواست اضافه به API دیجی‌کالا ارسال شود. قابلیت مرتب‌سازی درخواست‌های خودش را می‌فرستد، همان‌طور که بالا توضیح داده شد. با مسئولیت خودتان استفاده کنید و قوانین دیجی‌کالا را بررسی کنید. اگر دیجی‌کالا سایت را تغییر دهد و اسکریپت از کار بیفتد، لطفاً یک Issue باز کنید.

مجوز: [MIT](LICENSE)

</div>
