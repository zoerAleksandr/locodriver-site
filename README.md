# locodriver.ru — статический сайт

Содержимое для публикации на домене **locodriver.ru** через **Cloudflare Pages**.

Эта папка — staging area внутри основного репозитория LocoDriver.
В продакшне файлы должны лежать в **отдельном Git-репозитории**, подключённом
к Cloudflare Pages. Шаги ниже.

## Структура

```
website/
├── index.html                              ← главная страница (лендинг)
├── r/
│   └── index.html                          ← redirect-страница для shared-маршрутов
├── .well-known/
│   └── assetlinks.json                     ← Android App Links верификация
├── _headers                                ← конфигурация HTTP-заголовков Cloudflare Pages
└── README.md                               ← этот файл
```

## Что делает сайт

| URL | Что отдаётся | Когда это видит пользователь |
|---|---|---|
| `https://locodriver.ru/` | Главная страница (`index.html`) | При прямом заходе на домен |
| `https://locodriver.ru/r/{id}` | Redirect-страница (`r/index.html`) | Только если App Links не сработали (десктоп, старый Android, нет приложения). На современном Android с настроенным App Link страница НЕ загружается — ОС открывает приложение напрямую. |
| `https://locodriver.ru/.well-known/assetlinks.json` | JSON с SHA-256 ключа подписи | Эту ссылку Android запрашивает один раз при установке приложения, чтобы зарегистрировать App Link. Пользователь её не видит. |

## Деплой на Cloudflare Pages

### Шаг 1. Создать отдельный GitHub-репозиторий

1. Зайти на https://github.com/new
2. Имя: `locodriver-site` (или любое другое)
3. Visibility: **Public** или **Private** — Cloudflare Pages работает с обоими
4. Создать
5. Скопировать **содержимое папки `website/`** из основного репозитория LocoDriver
   в корень нового репозитория `locodriver-site` (без самой папки `website/` — её содержимое должно быть на верхнем уровне нового репо)
6. Закоммитить и запушить

Структура `locodriver-site` должна быть такой:
```
locodriver-site/
├── index.html
├── r/index.html
├── .well-known/assetlinks.json
└── _headers
```

### Шаг 2. Подключить к Cloudflare Pages

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Авторизоваться через GitHub, выбрать репозиторий `locodriver-site`
3. Build settings:
    - **Project name:** `locodriver-site`
    - **Production branch:** `main`
    - **Framework preset:** `None`
    - **Build command:** оставить пустым
    - **Build output directory:** `/`
4. **Save and Deploy**
5. Через минуту получите URL `https://locodriver-site.pages.dev` — это пока временный домен. Откройте его, проверьте что главная и `/r/test` работают.

### Шаг 3. Привязать собственный домен locodriver.ru

1. В свойствах созданного Pages-проекта → **Custom domains** → **Set up a custom domain**
2. Ввести `locodriver.ru` → Cloudflare автоматически добавит DNS-запись (если домен уже добавлен в Cloudflare DNS) и выпустит HTTPS-сертификат через Let's Encrypt
3. Подождать ~5–10 минут — статус сменится на **Active**
4. Дополнительно в **Custom domains** → добавить ещё `www.locodriver.ru`
   с настройкой redirect → `locodriver.ru` (или просто оставить два домена)

### Шаг 4. Проверить

В браузере должны открываться:

```
https://locodriver.ru/                                  → главная
https://locodriver.ru/r/test                            → redirect-страница (она пытается открыть locodriver://share/test и через 1.5с показывает кнопку RuStore)
https://locodriver.ru/.well-known/assetlinks.json       → JSON с SHA-256
```

**Проверка `assetlinks.json` через Google API:**
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://locodriver.ru&relation=delegate_permission/common.handle_all_urls
```
Откройте этот URL — должен вернуться JSON с одним statement, в котором ваш package_name и SHA-256.

## Связь с приложением

После того как `assetlinks.json` доступен по адресу `https://locodriver.ru/.well-known/assetlinks.json`,
**пересоберите Android-приложение и установите его на устройство**. При первом запуске Android
обратится к этому файлу и зарегистрирует App Link. Проверить, прошла ли верификация:

```bash
adb shell pm get-app-links com.z_company.loco_driver
```

Должно быть `verified` для домена `locodriver.ru`. Если `1024 (legacy_failure)` или `1` — что-то не так:
- проверьте, что `_headers` корректно отдаёт `Content-Type: application/json` для `.well-known/assetlinks.json`
- убедитесь, что SHA-256 в `assetlinks.json` совпадает с реальным ключом подписи установленного APK
- передеплойте сайт после правки

## Когда обновлять файлы здесь

| Когда | Что делать |
|---|---|
| Сменился ключ подписи Android (новый keystore) | Обновить SHA-256 в `.well-known/assetlinks.json` |
| Появилась публикация в Google Play | Добавить второй SHA-256 (из Play Console → App signing) в `sha256_cert_fingerprints` |
| Появился платный Apple Developer Program | Добавить файл `.well-known/apple-app-site-association` (формат описан в Apple docs) |
| Хочется обновить лендинг | Редактируйте `index.html` |
| Сменился иконка/название стора | Обновите ссылки в `index.html` и `r/index.html` |

## Структура исходящей и входящей ссылки

**Отправитель** в приложении нажимает «Поделиться»:
1. `POST /v1/share/route` на API → сервер сохраняет маршрут и возвращает короткий `id`
2. Клиент формирует ссылку: `https://locodriver.ru/r/{id}`
3. Открывается системный share-sheet → пользователь шлёт ссылку в Telegram

**Получатель** нажимает ссылку в Telegram:
1. Telegram видит `https://` → ссылка кликабельна
2. Android (с верифицированным App Link) открывает приложение напрямую → MainActivity получает Intent
3. `ShareRouteManager.parseShareId` извлекает `id` из URL
4. Приложение делает `GET /v1/share/route/{id}` → получает Route JSON
5. Route переприсваивается (`reidentifyForImport`) и сохраняется в локальную БД
6. Открывается `FormRoute` с импортированным маршрутом

Если App Link не зарегистрирован (например, приложения нет) — Telegram открывает ссылку в браузере,
браузер загружает `r/index.html`, которая пытается открыть `locodriver://share/{id}` через
кастомную схему. Если приложение установлено, но App Link не верифицирован — кастомная схема
сработает. Если приложения нет — через 1.5 секунды пользователь увидит кнопку «Скачать в RuStore».

## iOS

На iOS в текущей конфигурации **не используются Universal Links** (нет Apple Developer Program).
iOS-устройства открывают `locodriver.ru/r/{id}` в Safari → JavaScript на странице пытается
открыть `locodriver://share/{id}` через кастомную URL-схему, зарегистрированную в `Info.plist`.
iOS покажет диалог «Открыть в LocoDriver?» — пользователь подтверждает, приложение открывается.

Когда оплатите Apple Developer Program ($99/год) и захотите включить полноценные Universal Links,
сделайте следующее:

1. Создайте файл `.well-known/apple-app-site-association` (без расширения!) с содержимым:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [{
         "appID": "TEAM_ID.com.z_company.loco_driver",
         "paths": ["/r/*"]
       }]
     }
   }
   ```
   Подставьте свой Team ID вместо `TEAM_ID`.
2. В Xcode-проекте: TARGETS → iosApp → Signing & Capabilities → **+ Capability** → **Associated Domains**
   → добавьте `applinks:locodriver.ru`.
3. Передеплойте сайт и пересоберите приложение.
