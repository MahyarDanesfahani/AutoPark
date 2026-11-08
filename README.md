# 🚗 AutoPark Lab

## شبیه‌ساز سه‌بعدی و تعاملی پارک خودکار

یک آزمایشگاه بصری برای بررسی و مقایسه‌ی الگوریتم‌های برنامه‌ریزی حرکت خودرو در محیط‌های پارکینگ. این پروژه مسیر پیدا‌شده را فقط روی نمودار نشان نمی‌دهد؛ خودرو، موانع، گره‌های جست‌وجو، مسیر حرکتی، دنده‌عقب‌ها و نتیجه‌ی نهایی را در یک صحنه‌ی سه‌بعدی تعاملی نمایش می‌دهد.

> هدف پروژه، تبدیل مفاهیم پیچیده‌ی رباتیک و برنامه‌ریزی مسیر به یک تجربه‌ی قابل مشاهده، قابل آزمایش و مناسب برای ارائه‌ی دانشگاهی است.

---

## ✨ امکانات اصلی

- نمایش سه‌بعدی خودرو، موانع، جایگاه پارک و مسیر حرکت
- سناریوهای پارک موازی، عمودی و مورب ۴۵ درجه
- تنظیم سختی و فشرده‌تر شدن فضای پارک
- مقایسه‌ی Hybrid A*، A* روی شبکه‌ی حالت و RRT
- اجرای چندباره‌ی RRT با seedهای متفاوت و گزارش نرخ موفقیت
- نمایش گره‌های جست‌وجو و ناحیه‌ی اکتشاف
- پخش انیمیشن مسیر و کنترل سرعت
- تشخیص برخورد هنگام اجرای انیمیشن و توقف مسیر در صورت برخورد
- جدول نتایج، نمودار میله‌ای و جدول سوابق پارک
- نمایش الگوریتم فعال در حالت مقایسه
- پشتیبانی از فارسی، انگلیسی، RTL و LTR
- اجرای کاملاً آفلاین بدون نیاز به اینترنت

---

## 🧠 الگوریتم‌ها

### Hybrid A*

الگوریتم اصلی پروژه است. فضای حالت خودرو را با موقعیت، زاویه، حرکت جلو و عقب بررسی می‌کند و با استفاده از اتصال تحلیلی Reeds–Shepp می‌تواند مسیر را دقیق‌تر به هدف متصل کند. این الگوریتم معمولاً بهترین دقت و کیفیت کلی را ارائه می‌دهد.

### A* State Lattice

یک baseline گسسته و قابل توضیح است که موقعیت و زاویه را در شبکه‌ای از حالت‌ها بررسی می‌کند. این روش رفتار قابل پیش‌بینی دارد، اما به رزولوشن شبکه وابسته است و در فضاهای بسیار تنگ ممکن است شکست بخورد.

### RRT

یک الگوریتم تصادفی است که با رشد یک درخت از نقطه‌ی شروع، فضای حالت را جست‌وجو می‌کند. RRT برای فضاهای پیچیده مناسب است، اما به seed وابسته است و معمولاً مسیر طولانی‌تر و تعداد دنده‌عقب بیشتری دارد.

برای RRT، زمان و تعداد گره‌ها از همه‌ی اجراها محاسبه می‌شوند و نرخ موفقیت نیز در جدول نمایش داده می‌شود.

---

## 🅿️ سناریوهای پارک

### پارک موازی

خودرو باید از مسیر عبوری وارد فضای خالی بین خودروهای پارک‌شده شود و با مانورهای جلو و عقب در جایگاه قرار بگیرد.

### پارک عمودی

خودرو از مسیر دسترسی وارد جایگاه عمودی می‌شود و در انتهای جایگاه با زاویه‌ی مناسب پارک می‌کند.

### پارک مورب ۴۵ درجه

جایگاه‌ها با زاویه‌ی ۴۵ درجه ساخته می‌شوند و خودرو باید با جهت نهایی مناسب در فضای مورب قرار بگیرد.

در هر سناریو می‌توان سختی فضا را تغییر داد و اثر آن را روی موفقیت الگوریتم‌ها دید.

---

## 📊 معیارهای مقایسه

| معیار | توضیح |
|---|---|
| زمان محاسبه | مدت اجرای planner بر حسب میلی‌ثانیه |
| طول مسیر | مجموع طول قطعات مسیر بر حسب متر |
| تعداد دنده‌عقب | تعداد تغییر جهت بین حرکت جلو و عقب |
| خطای مکانی | فاصله‌ی موقعیت نهایی از هدف بر حسب سانتی‌متر |
| خطای زاویه‌ای | اختلاف زاویه‌ی نهایی خودرو با هدف |
| گره‌های بررسی‌شده | تعداد حالت‌ها یا گره‌های گسترش‌یافته |
| نرخ موفقیت | مخصوص اجرای چندباره‌ی RRT |
| تعداد برخورد | برخوردهای مشاهده‌شده هنگام پخش مسیر |
| امتیاز کیفیت | امتیاز ترکیبی بر اساس دقت، طول مسیر و دنده‌عقب |

مقدار بهتر هر معیار در جدول با رنگ طلایی مشخص می‌شود.

---

## 🎮 راهنمای استفاده

1. سناریوی پارک را انتخاب کنید.
2. سختی فضای پارک را تغییر دهید.
3. الگوریتم یا گزینه‌ی «مقایسه هر سه» را انتخاب کنید.
4. برای RRT تعداد اجراها را مشخص کنید.
5. روی «محاسبه مسیر» کلیک کنید.
6. وضعیت اجرای هر الگوریتم را در پنل نتایج ببینید.
7. مسیر موفق را با «پخش مسیر» اجرا کنید.
8. با «نمایش گره‌های جست‌وجو» فرایند اکتشاف را ببینید.
9. با نماهای صحنه، بالا، کنار و راننده زاویه‌ی دوربین را تغییر دهید.

کنترل‌های سریع:

- `Space`: پخش یا توقف مسیر
- موس: چرخش و زوم دوربین
- دکمه‌ی زبان: تغییر فارسی و انگلیسی
- بازنشانی: برگرداندن خودرو به نقطه‌ی شروع

در حالت مقایسه، الگوریتمی که در حال پخش است با عنوان «الگوریتم در حال پخش» مشخص می‌شود.

---

## ▶️ اجرا

### ویندوز با یک کلیک

فایل زیر را اجرا کنید:

```text
start.bat
```

سپس مرورگر روی این آدرس باز می‌شود:

```text
http://localhost:8080
```

### اجرای دستی با Node.js

```bash
node server.mjs 8080
```

### اجرای دستی با Python

```bash
python -m http.server 8080
```

پروژه از Three.js، OrbitControls و فونت‌های local استفاده می‌کند و برای اجرا به اینترنت نیاز ندارد.

---

## 🧪 تست‌ها

```bash
node test/test_rs.mjs
```

تست منحنی‌های Reeds–Shepp، برخورد OBB و حرکت مستقیم.

```bash
node test/test_scenarios.mjs
```

تست معتبر بودن نقطه‌ی شروع، هدف، محدوده و هندسه‌ی سناریوها.

```bash
node test/test_planners.mjs
```

اجرای ماتریس کامل الگوریتم‌ها در تمام سناریوها و بررسی برخورد مسیرهای موفق.

نتیجه‌ی مورد انتظار تست مسیرها:

```text
ALL PATHS VALID
```

---

## 🗂️ ساختار پروژه

```text
project_autoPark/
├── index.html                 صفحه‌ی اصلی رابط کاربری
├── start.bat                  اجرای سریع ویندوز
├── server.mjs                 سرور استاتیک آفلاین
├── README.md                  مستندات پروژه
├── css/style.css              طراحی و layout واکنش‌گرا
├── lib/                       Three.js، کنترل دوربین و فونت‌ها
├── js/
│   ├── main.js                اتصال UI، الگوریتم‌ها و صحنه
│   ├── scene3d.js             صحنه، خودروها، مسیر و انیمیشن
│   ├── ui.js                  جدول‌ها، نمودار و وضعیت‌ها
│   ├── i18n.js                فارسی/انگلیسی و RTL/LTR
│   ├── metrics.js             اجرای الگوریتم‌ها و معیارها
│   ├── vehicle.js              مدل سینماتیک خودرو
│   ├── collision.js            برخورد OBB با SAT
│   ├── reedsShepp.js           منحنی‌های Reeds–Shepp
│   ├── scenarios.js            سناریوهای پارک
│   └── algorithms/             پیاده‌سازی plannerها
└── test/                       تست‌های Node.js
```

---

## 🔍 مدل خودرو و برخورد

وضعیت خودرو با مدل سینماتیک دوچرخه‌ای و به شکل زیر نمایش داده می‌شود:

```text
(x, y, theta)
```

بدنه‌ی خودرو و موانع به‌صورت مستطیل‌های جهت‌دار یا OBB مدل می‌شوند. برای بررسی هم‌پوشانی از روش SAT استفاده می‌شود. هر قطعه‌ی مسیر نیز با نمونه‌برداری از چندین وضعیت بررسی می‌شود تا برخورد در طول مسیر پنهان نماند.

---

## ⚠️ محدودیت‌ها

- هیچ plannerای در همه‌ی فضاهای بسیار تنگ تضمین موفقیت ندارد.
- A* گسسته است و ممکن است در پارک موازی یا شبکه‌های محدود شکست بخورد.
- RRT تصادفی است و با seed و تعداد اجرا تغییر می‌کند.
- سخت‌ترین حالت پارک موازی ممکن است به timeout برسد.
- پروژه برای آموزش و ارائه ساخته شده و جایگزین کنترلر واقعی خودرو نیست.

---

## 🚀 ایده‌های توسعه‌ی آینده

- افزودن D*، RRT* و plannerهای lattice پیشرفته
- خروجی CSV برای نتایج
- نمودار نرخ موفقیت بر اساس سختی
- گزارش انحراف معیار و تحلیل آماری
- ساخت سناریوی سفارشی توسط کاربر
- شبیه‌سازی سنسور و عدم قطعیت موقعیت
- استفاده از Web Worker برای جست‌وجوهای سنگین
- ذخیره و replay کردن مسیرها

---

## English Overview

### Interactive 3D Autonomous Parking Simulator

AutoPark Lab is an offline, browser-based simulator for visualizing and comparing motion-planning algorithms for autonomous parking. It combines a kinematic vehicle model, oriented-box collision detection, Reeds–Shepp connections, interactive 3D rendering, path animation, search-node visualization, and performance reporting.

The simulator supports parallel, perpendicular, and 45-degree angled parking. Users can adjust slot difficulty, run one planner or compare all three, execute multiple RRT seeds, play the selected trajectory, inspect search nodes, and review planning time, path length, reversals, pose error, heading error, expanded nodes, success rate, collisions, and parking quality.

### Planners

- **Hybrid A***: continuous-style search with motion primitives and an analytic Reeds–Shepp finish. Usually the most accurate planner.
- **State-Lattice A***: deterministic discretized baseline. Easy to explain, but sensitive to grid resolution and tight spaces.
- **RRT**: randomized tree exploration. Flexible in complex spaces, but seed-dependent and often less efficient.

### Quick start

```bash
node server.mjs 8080
```

Open `http://localhost:8080` in a browser.

Run the tests:

```bash
node test/test_rs.mjs
node test/test_scenarios.mjs
node test/test_planners.mjs
```

### Educational use

This project is intended for research, academic presentations, and teaching motion planning, vehicle kinematics, collision detection, and search-based algorithm comparison. It is not a production-grade vehicle control system.

---

## 👨‍💻 هدف پروژه / Project purpose

این پروژه برای پژوهش، ارائه و آموزش مفاهیم برنامه‌ریزی حرکت، مدل‌سازی سینماتیک، تشخیص برخورد و مقایسه‌ی الگوریتم‌های جست‌وجو طراحی شده است.

This project is designed for research, academic presentation, and teaching motion planning, vehicle kinematics, collision detection, and search-based algorithm comparison.
