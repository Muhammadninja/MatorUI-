# Локальная интеграционная среда Mator

Эта среда запускает настоящий NestJS backend, PostgreSQL и Redis на loopback.
Запросы приложения реальные; пользователь, автомобили, товары, адрес и заказы
синтетические. Это не `.maestro` mock-server. Production БД и реальные провайдеры
не нужны и не используются.

## Требования

- Node.js 22+ и npm; зависимости приложения устанавливаются через `npm ci`.
- PostgreSQL 15+ (`initdb`, `pg_ctl`, `psql`, `createdb`) и Redis (`redis-server`,
  `redis-cli`) в `PATH`. На macOS, например: `brew install postgresql@16 redis`;
  добавьте `$(brew --prefix postgresql@16)/bin` в `PATH`, если формула keg-only.
- Backend-репозиторий рядом с приложением: `../mator.uz/Backend`, либо путь
  `MATOR_BACKEND_DIR=/absolute/path/to/Backend`.
- Backend commit `0381bc5637969069e7fd22c96423775f31e27c7b` должен существовать в его
  git history. Setup архивирует именно этот commit, независимо от текущей ветки
  и незакоммиченных изменений. Версия задаётся в
  `config/local-integration/services.json`; обновление требует повторной проверки.
- Для native UI нужен уже установленный совместимый iOS development client.
  Проверялся iPhone 16 Pro / iOS 18.3. Android не проверялся.

Docker не требуется. Скрипты используют отдельные native PostgreSQL/Redis
процессы, не Homebrew services и не существующую пользовательскую БД.

## Первый запуск

Из корня `matorui`:

```bash
npm ci
npm run integration:setup
npm run integration:start
```

Во втором терминале:

```bash
npm run integration:smoke
npm run integration:seed
npm run start:local
```

Setup создаёт игнорируемый git каталог `.local/integration`, собственный
PostgreSQL-кластер, БД `mator_integration`, Redis, копию закреплённого backend и
локальные JWT-ключи. Затем выполняет отдельный `npm ci`, Prisma generate,
`prisma migrate deploy` (53 миграции на проверенной версии), штатный seed
справочников, синтетический seed и backend build. Файлы `.env`, ключи и
`node_modules` из исходного backend не копируются.

Подключите dev client через **Enter URL manually → `http://localhost:8082`**.
iOS Simulator использует localhost хоста; адрес API — `http://127.0.0.1:3300`.
Metro стартует с IPv4 localhost и очищенным кешем. Смена env требует перезапуска
Metro, поскольку Expo 56 может кешировать virtual env-модуль.

В приложении войдите по синтетическому номеру **`+998900000001`**. Локальный
backend возвращает dev OTP без SMS; приложение разрешает его только для явно
локальной development-сборки. Это не проверка production OTP.

## Конфигурация и переключение среды

Порты по умолчанию задаёт `config/local-integration/services.json`:

| Сервис | Адрес |
| --- | --- |
| Backend | `127.0.0.1:3300` |
| PostgreSQL | `127.0.0.1:55432` |
| Redis | `127.0.0.1:56379` |
| Metro | `localhost:8082` |

Для независимого runtime задайте одинаковые переменные во всех его терминалах:

```bash
export MATOR_INTEGRATION_DIR="$PWD/.local/integration-clean"
export MATOR_API_PORT=3302
export MATOR_POSTGRES_PORT=55434
export MATOR_REDIS_PORT=56381
npm run integration:setup
npm run integration:start
```

`start:local` читает `MATOR_API_PORT`. Пароли/токены провайдеров не передавайте.
Скрипты дочерних процессов получают только whitelist системного окружения и
генерируемые локальные настройки. Nest local adapter запрещает загрузку `.env`.

- `npm run start:local` — dev client с видимой маркировкой LOCAL.
- `npm run start:production` — development-сессия против production API. Для
  неё нельзя создавать тестовые заказы/платежи или применять локальный seed.
- `npm run export:production:ios` — проверяемый production export с явной
  release-конфигурацией, а не запуск локальной среды. Это JS bundle, не Xcode build.

Публичный `.env.example` приложения содержит только примеры конфигурации, без
секретов. Генерируемые `environment.json`, `jwt.json` и backend.log находятся
только внутри игнорируемого runtime; их нельзя публиковать. Лог backend может
содержать синтетические dev OTP.

## Данные для аудита

`integration:seed` можно запускать повторно. Стабильные IDs и upsert не создают
дубликаты. Seed сохраняет выбранный автомобиль и изменённые количества;
отсутствующие тестовые строки корзины восстанавливает, существующие не удваивает.
Smoke специально очищает тестовую корзину; после него запускайте seed.

- `veh_local_seed`: основной Cobalt 2024, trim `cobalt-p1-elegant`, engine из
  штатного справочника; выбран по умолчанию при первом seed.
- `veh_local_second`: явно синтетическая модель и комплектация с длинными
  русскими/узбекскими названиями, видимыми в Garage.
- `veh_local_third`: дополнительный Cobalt для заполненного Garage.
- `part_local_exact`: `EXACT_MATCH`, 100 000 UZS.
- `part_local_no`: `NOT_COMPATIBLE`, 120 000 UZS.
- `part_local_unknown`: нет записей совместимости, `UNCERTAIN`,
  `isCompatible=false`, 130 000 UZS.
- `part_local_universal`: `UNIVERSAL`, 50 000 UZS.
- Длинный двуязычный адрес `addr_local_test`; заполненная корзина из трёх
  разных товаров. Названия начинаются с `LOCAL TEST`.

Совместимость — управляемые примеры для проверки контракта, не экспертное
утверждение о реальных запчастях. Изображения отсутствуют намеренно: используется
обычное empty-image состояние приложения, без внешнего CDN.

## Проверки и ограничения

`integration:smoke` делает 24 настоящих HTTP-запроса: local OTP, создание/выбор/
удаление временного автомобиля, четыре случая совместимости, добавление/количество/
удаление корзины, чтение адреса/оплаты, доставка и создание cash-заказа только в
изолированной БД. Проверяет `200 000 + 25 000 + 5 000 = 230 000 UZS` и пустую
корзину после оформления. Результат без токенов — `smoke-results.json` в runtime.
Это не замена native UI, холодного запуска, проверки тем или клавиатуры.

`node --test scripts/local-integration/guard.check.cjs` проверяет запрет внешних
HTTP/HTTPS/fetch/socket соединений и отказ при non-local DB/production env.
Локальный adapter `config/local-integration/backend-local.patch` применяется
только к runtime-копии: loopback listener, `ignoreEnvFile` и безопасный флаг
`UNCERTAIN`. Контекст патча и результат проверяются до запуска. Он не меняет production bootstrap/OTP. Upstream исправление
`UNCERTAIN` отдельно закреплено backend-коммитом `17e68293`.

Не проверены и отключены в этой среде: реальные SMS, email, push, Cloudinary,
AI/обработка изображений, Telegram, реальные платежи и доставка. Для обязательных
конструкторов заданы нерабочие placeholders; preload блокирует внешнюю сеть.
Payme/Click sandbox credentials не настроены, счета/платежи не запускаются.

Проверка воспроизводимости 2026-11-02 выполнена в новом каталоге, с новым
PostgreSQL-кластером и пустой БД, из чистого закреплённого git archive, отдельным
`npm ci` (980 пакетов), всеми 53 миграциями, seed и успешной backend-сборкой.
Smoke прошёл все 24 HTTP-запроса. Исходный `/tmp/mator-integration` не использовался.
Существующие npm deprecation warnings и Prisma package.json warning остаются.

Та же инструкция повторно прошла в стандартном `.local/integration` внутри
frontend-репозитория: setup, backend build, 24 HTTP-запроса и повторный seed.
Применение local adapter проверяет каждое ожидаемое изменение и не зависит от
родительского git worktree. `.local` исключён из Metro и Vitest, чтобы копия
backend и её зависимости/тесты не попадали в frontend-сборку или frontend suite.

Frontend-проверки: 61 test file / 864 tests, typecheck и два Node guard-check
прошли. Production iOS export проверяется через `export:production:ios`;
это Hermes JS-bundle, не native Xcode release rebuild. Regression-тесты покрывают
`UNCERTAIN/isCompatible=false`, смену part/vehicle/VIN с задержанным ответом,
старый кеш корзины, задержанную гидратацию и восстановление авторизации.
Development-индикатор и dev OTP отсутствуют в release-пути; выбор HTTP auth в
release принудительный, даже если локальная конфигурация ошибочно отключила gate.

## Остановка и восстановление

```bash
npm run integration:status
npm run integration:stop
```

Остановка проверяет принадлежность процессов runtime и сохраняет БД. После неё
`integration:start` снова запускает сервисы; JWT-ключи стабильны между рестартами.
Для полностью новой среды задайте новый `MATOR_INTEGRATION_DIR`; не удаляйте
каталог работающего PostgreSQL. Существующий `/tmp/mator-integration` не нужен.

Если запуск заблокирован, сообщение назовёт недостающее: backend commit/path,
исполняемый файл PostgreSQL/Redis, занятый порт или несовпадающую идентичность
процесса. В ограниченном sandbox потребуются разрешения на shared memory,
localhost listener и скачивание npm-зависимостей. Секреты для устранения этих
блокировок не нужны.
