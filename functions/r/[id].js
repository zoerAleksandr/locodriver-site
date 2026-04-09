/**
 * Cloudflare Pages Function — обрабатывает запросы /r/{id}.
 *
 * Возвращает HTML redirect-страницу с уже подставленным server-side
 * идентификатором маршрута. Страница через JavaScript пытается открыть
 * deep link locodriver://share/{id}, а через 1.5 секунды показывает
 * fallback-кнопку «Скачать в RuStore».
 *
 * Почему HTML внутри функции, а не отдельный файл:
 *  - Cloudflare Pages free tier не поддерживает dynamic splat rewrites в _redirects
 *  - env.ASSETS.fetch с rewrite-ом URL работает нестабильно
 *  - Подход с одной функцией, содержащей весь HTML, гарантированно работает
 *    и не требует дополнительной инфраструктуры
 *
 * Cloudflare автоматически парсит [id] из имени файла и кладёт его
 * в context.params.id при запросе вида /r/{что_угодно}.
 */

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#0f1722">
    <title>Открываем маршрут в LocoDriver…</title>
    <meta name="robots" content="noindex">
    <style>
        :root {
            --bg: #0f1722;
            --fg: #e8edf5;
            --muted: #8a96aa;
            --accent: #4f8cff;
            --accent-hover: #6aa1ff;
            --card: #182233;
            --border: #25324a;
        }
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--fg);
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }
        .wrap {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px 20px;
            text-align: center;
        }
        .logo {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
            margin-bottom: 8px;
        }
        .logo span { color: var(--accent); }
        h1 {
            font-size: 18px;
            font-weight: 500;
            margin: 24px 0 8px;
        }
        p {
            font-size: 14px;
            color: var(--muted);
            margin: 4px 0;
            line-height: 1.5;
            max-width: 360px;
        }
        .spinner {
            margin: 24px auto;
            width: 40px;
            height: 40px;
            border: 3px solid var(--border);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fallback {
            display: none;
            margin-top: 32px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px 20px;
            max-width: 400px;
            width: 100%;
        }
        .fallback.show { display: block; }
        .fallback h2 {
            font-size: 16px;
            margin: 0 0 8px;
            color: var(--fg);
        }
        .fallback p { color: var(--muted); margin-bottom: 16px; }
        .btn {
            display: inline-block;
            background: var(--accent);
            color: #fff;
            text-decoration: none;
            padding: 12px 22px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            margin: 6px 4px;
            transition: background .15s;
        }
        .btn:hover, .btn:active { background: var(--accent-hover); }
        .btn.secondary {
            background: transparent;
            color: var(--accent);
            border: 1px solid var(--border);
        }
        .footer {
            margin-top: auto;
            padding-top: 32px;
            font-size: 12px;
            color: var(--muted);
        }
        .footer a { color: var(--muted); text-decoration: underline; }
        @media (prefers-color-scheme: light) {
            :root {
                --bg: #f6f8fc;
                --fg: #0f1722;
                --muted: #5a6577;
                --card: #ffffff;
                --border: #e1e6f0;
            }
        }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="logo">Loco<span>Driver</span></div>
        <div class="spinner"></div>
        <h1>Открываем маршрут…</h1>
        <p id="hint">Если приложение установлено, оно откроется автоматически.</p>

        <div class="fallback" id="fallback">
            <h2>Приложение не открылось?</h2>
            <p>Установите LocoDriver, чтобы открывать маршруты по ссылке.</p>
            <a class="btn" href="https://www.rustore.ru/catalog/app/com.z_company.loco_driver">
                Скачать в RuStore
            </a>
            <br>
            <a class="btn secondary" id="btn-retry" href="#">Попробовать снова</a>
        </div>

        <div class="footer">
            <a href="/">На главную</a>
        </div>
    </div>

    <script>
        // shareId уже подставлен на сервере — без парсинга window.location.
        (function () {
            const shareId = "__SHARE_ID__";

            if (!shareId) {
                document.getElementById('hint').textContent = 'Ссылка повреждена.';
                document.getElementById('fallback').classList.add('show');
                return;
            }

            const deepLink = 'locodriver://share/' + encodeURIComponent(shareId);
            const retryBtn = document.getElementById('btn-retry');
            retryBtn.href = deepLink;
            retryBtn.addEventListener('click', function (e) {
                e.preventDefault();
                window.location.href = deepLink;
            });

            // Попытка открыть приложение через кастомную схему.
            // На Android с настроенными App Links эта страница вообще не
            // загрузится — ОС перехватит ссылку и откроет приложение напрямую.
            try {
                window.location.replace(deepLink);
            } catch (_) { /* ignore */ }

            // Через 1.5 секунды показываем fallback с кнопкой магазина.
            setTimeout(function () {
                document.getElementById('fallback').classList.add('show');
            }, 1500);
        })();
    </script>
</body>
</html>`;

export async function onRequest(context) {
    // Cloudflare Pages автоматически парсит [id] из имени файла функции
    // и кладёт его в context.params.id при запросах /r/{что_угодно}.
    const rawId = context.params.id ?? "";
    // На случай, если id содержит подпуть (из-за catch-all в других настройках)
    const id = Array.isArray(rawId) ? rawId[0] : String(rawId);

    // Экранируем id, чтобы не сломать строку в JS и не позволить XSS.
    // Разрешаем только безопасные символы UUID/id: буквы, цифры, дефис,
    // подчёркивание, точка. Остальное заменяем на пустую строку.
    const safeId = id.replace(/[^A-Za-z0-9._-]/g, "");

    const html = HTML_TEMPLATE.replace("__SHARE_ID__", safeId);

    return new Response(html, {
        status: 200,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
        },
    });
}
