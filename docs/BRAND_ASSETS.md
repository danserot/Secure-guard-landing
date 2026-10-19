# Логотип SecureGuard

Источник пользователя: `C:\Users\Asus\Downloads\Logo-SG` — PNG без расширения,
содержащий полный логотип и отдельный знак щита. Исходник не изменён.

## Файлы сайта

- `frontend/public/brand/secureguard-logo.png` — логотип с надписью, прозрачный фон.
  Один компонент `Brand` выводит его в header и footer. На синем фоне используется
  белая монохромная версия через CSS filter, на светлом — сине-зелёная.
- `frontend/public/brand/secureguard-mark.png` — отдельный знак, 256×256.
- `frontend/public/favicon-32.png` — favicon 32×32.
- `frontend/public/favicon-192.png` — favicon 192×192.
- `frontend/public/apple-touch-icon.png` — иконка 180×180.

Размер полного логотипа: 260 px на desktop, 220 px на узком desktop/tablet,
205 px на телефоне; в footer — 240/205 px. Сохранены пропорции изображений,
доступное имя ссылки и переход на `/landing`.

Проверено в Edge на ширинах 360, 390, 651, 768, 901, 1024 и 1440 px:
оба изображения загрузились, логотип не пересекается с навигацией, горизонтального
скролла нет. Мобильное меню открывается. Favicon, touch icon и полный логотип
возвращают HTTP 200 с `Content-Type: image/png`. Production-сборка прошла.

## Подготовка ассетов

Использован встроенный ImageGen, режим редактирования `background-extraction`,
на основе предоставленного изображения. Выбранные результаты экспортированы
в веб-размеры с сохранением прозрачности; для favicon используется только щит.
Светлые растровые варианты не используются: header получает чистый монохром
из того же полного логотипа средствами CSS.

Промпт полного логотипа:

> Extract ONLY the LARGE top horizontal SecureGuard logo from the reference.
> Preserve precisely its shield monogram shape, proportions, navy lettering and
> emerald top-right shield segment. Text verbatim: SecureGuard. Remove the off-white
> paper background completely and remove both smaller logos below. Tightly frame
> this one horizontal lockup with minimal transparent padding, no canvas margins.
> Actual transparent background. No redesign, new typography, shadows, mockup,
> or texture. Crisp clean logo asset for website footer. Wide landscape.

Промпт знака:

> Extract ONLY the small standalone navy-and-emerald shield monogram at bottom
> left of the reference, for a website favicon. Preserve the precise recognizable
> interlocking SG shield geometry and emerald top-right segment, navy remainder.
> Remove every wordmark, every other logo, and all background. Render this single
> shield centered, occupying about 90% of a square canvas with transparent surrounding
> background and genuinely transparent internal negative space. Flat crisp solid
> shapes with smooth antialiasing. No new symbol, no redesign, no lettering outside
> the shield, no shadow, no mockup.
