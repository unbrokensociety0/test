document.addEventListener('DOMContentLoaded', () => {
    let tg;
    let tgUser = null;
    let tgInitData = null;

    // ❗️ ВАЖНО ❗️
    // Укажите здесь URL, который вам выдаст `lt --port 8080`
    // Например: "https://some-name.loca.lt"
    // Если вы тестируете на GitHub Pages, этот URL должен быть там.
    // Если фронтенд и бэкенд на одном домене, оставьте пустым "".
    const API_BASE_URL = "ttps://young-wasps-grin.loca.lt"; // <-- ЗАМЕНИТЕ ЭТО ПРИ НЕОБХОДИМОСТИ

    // --- 0. Элементы модального окна ---
    const modal = document.getElementById('qr-modal');
    const modalClose = document.getElementById('modal-close');
    const modalQrImage = document.getElementById('modal-qr-image');

    try {
        tg = window.Telegram.WebApp;

        // --- 1. Инициализация приложения ---
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#ffffff');
        tg.setBackgroundColor('#f3f4f6');

        console.log("Telegram Web App SDK initialized.");

        // Cохраняем initData для API-запросов
        tgInitData = tg.initData;

        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            tgUser = tg.initDataUnsafe.user;
            loadUserData(tgUser);
        } else {
            console.warn("User data not found. Using mock data.");
            // Mock data for testing outside Telegram
            tgUser = { id: 123456, first_name: "Иван", last_name: "Иванов", username: "ivanivanov", photo_url: null };
            tgInitData = "mock_init_data_for_testing"; // Заглушка для тестов вне Telegram
            loadUserData(tgUser);
        }

    } catch (e) {
        console.error("Telegram SDK error:", e);
        // Mock data for testing outside Telegram
        tgUser = { id: 123456, first_name: "Иван", last_name: "Иванов", username: "ivanivanov", photo_url: null };
        tgInitData = "mock_init_data_for_testing"; // Заглушка для тестов вне Telegram
        loadUserData(tgUser);
    }

    // --- 2. Логика навигации ---
    const pages = {
        events: document.getElementById('page-events'),
        nfts: document.getElementById('page-nfts'),
        profile: document.getElementById('page-profile'),
    };
    const navButtons = {
        events: document.getElementById('nav-events'),
        nfts: document.getElementById('nav-nfts'),
        profile: document.getElementById('nav-profile'),
    };

    function showPage(pageId) {
        Object.values(pages).forEach(page => page.classList.add('hidden'));
        Object.values(navButtons).forEach(button => button.classList.remove('active'));

        if (pages[pageId] && navButtons[pageId]) {
            pages[pageId].classList.remove('hidden');
            navButtons[pageId].classList.add('active');

            let bgColor = '#ffffff';
            if (pageId === 'profile') bgColor = '#E0E7FF';
            else if (pageId === 'events') bgColor = '#f3f4f6';

            if (tg) tg.setBackgroundColor(bgColor);
        }
    }

    navButtons.events.addEventListener('click', () => showPage('events'));
    navButtons.nfts.addEventListener('click', () => showPage('nfts'));
    navButtons.profile.addEventListener('click', () => showPage('profile'));

    showPage('events');

    // --- 3. Загрузка данных пользователя ---
    function loadUserData(user) {
        if (!user) return;
        const profileName = document.getElementById('profile-name');
        const profileUsername = document.getElementById('profile-username');
        const profileAvatar = document.getElementById('profile-avatar');

        let displayName = user.first_name || '';
        if (user.last_name) displayName += ' ' + user.last_name;
        profileName.textContent = displayName.trim() || 'Пользователь';

        profileUsername.textContent = user.username ? '@' + user.username : `ID: ${user.id}`;
        profileAvatar.src = user.photo_url || `https://placehold.co/64x64/E0E7FF/374151?text=${displayName.charAt(0) || 'U'}`;
    }

    // --- 4. Вспомогательная функция для Fetch API ---
    async function apiFetch(endpoint, options = {}) {
        if (!tgInitData) {
            console.error("tgInitData is not available. Cannot make API call.");
            if (tg) tg.showAlert("Ошибка: не удалось получить данные Telegram. Перезапустите приложение.");
            throw new Error("tgInitData is missing.");
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tgInitData}` // Главный элемент безопасности
            }
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...defaultOptions, ...options });

            if (!response.ok) {
                let errorData = { error: `HTTP error! status: ${response.status}` };
                try {
                     errorData = await response.json(); // Попробуем распарсить JSON ошибки
                } catch (e) {
                     console.warn("Could not parse error response as JSON");
                }
                console.error(`API Error ${response.status}:`, errorData.error);
                if (tg) tg.showAlert(`Ошибка: ${errorData.error}`);
                throw new Error(errorData.error);
            }
            return response.json();
        } catch (networkError) {
             console.error("Network or fetch error:", networkError);
             if (tg) tg.showAlert(`Ошибка сети: ${networkError.message}. Проверьте подключение.`);
             throw networkError; // Пробрасываем ошибку дальше
        }
    }

    // --- 5. "Оживленные" функции загрузки данных ---

    async function loadEvents() {
        const container = document.getElementById('events-container');
        container.innerHTML = '<p class="text-center text-gray-500 pt-10">Загрузка мероприятий...</p>';

        try {
            const eventsByDate = await apiFetch('/api/events');
            container.innerHTML = ''; // Очищаем заглушку

            if (Object.keys(eventsByDate).length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 pt-10">Пока нет ближайших событий.</p>';
                return;
            }

            // Рендерим группы
            for (const date in eventsByDate) {
                const events = eventsByDate[date];
                let dateGroupHtml = `<h2 class="text-xl font-bold text-black mb-3">${date}</h2>`;

                events.forEach(event => {
                    dateGroupHtml += createEventCardHtml(event);
                });

                const dateGroupDiv = document.createElement('div');
                dateGroupDiv.innerHTML = dateGroupHtml;
                container.appendChild(dateGroupDiv);
            }

        } catch (error) {
            console.error("Failed to load events:", error);
            // Ошибка уже показана в apiFetch
            container.innerHTML = '<p class="text-red-500 text-center">Не удалось загрузить мероприятия.</p>';
        }
    }

    function createEventCardHtml(event) {
        let buttonHtml = '';

        // Определяем кнопку в зависимости от статуса
        if (event.status === 'available') {
            buttonHtml = `<button class="btn-register btn-go" data-event-id="${event.id}" data-action="register">Пойду!</button>`;
        } else if (event.status === 'registered') {
            buttonHtml = `<button class="btn-register btn-registered" data-event-id="${event.id}" data-action="unregister">Вы зарегистрированы</button>`;
        } else if (event.status === 'waiting') {
            buttonHtml = `<button class="btn-register btn-waiting" data-event-id="${event.id}" data-action="unregister">В листе ожидания</button>`;
        } else if (event.status === 'full') {
             buttonHtml = `<button class="btn-register btn-waiting" data-event-id="${event.id}" data-action="register">В лист ожидания</button>`;
        }

        return `
            <div class="event-card mb-4">
                <div class="p-4 flex gap-4">
                    <img src="${event.logo_url || 'https://placehold.co/110x110/E0E7FF/374151?text=HSE'}" alt="Event logo" class="event-card-image">
                    <div class="flex flex-col justify-between flex-1 min-w-0"> <div>
                            <h3 class="font-bold text-lg leading-tight truncate">${event.title}</h3> <p class="text-sm text-gray-500 mt-2 line-clamp-2">${event.description}</p>
                            <div class="space-y-1 mt-3">
                                <p class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    ${event.time}
                                </p>
                                <p class="text-sm font-medium text-gray-700 flex items-center gap-2 truncate"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    <span>${event.address}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="p-4 border-t border-gray-100">
                    ${buttonHtml}
                </div>
            </div>
        `;
    }

    async function loadNFTs() {
        const container = document.getElementById('nfts-container');
        container.innerHTML = '<p class="col-span-2 text-center text-gray-500 pt-10">Загрузка NFT...</p>';

        try {
            const data = await apiFetch('/api/my-nfts');
            const nfts = data.nfts;

            container.innerHTML = ''; // Очищаем заглушку

            if (!nfts || nfts.length === 0) {
                container.innerHTML = '<p class="col-span-2 text-center text-gray-500 pt-10">У вас пока нет NFT.</p>';
                return;
            }

            // TODO: Улучшить - нужно парсить metadata_url параллельно
            // Сейчас просто показываем плейсхолдеры
            nfts.forEach(nft => {
                const nftCardHtml = `
                    <div class="nft-card relative">
                        <img src="https://placehold.co/300x300/111827/FFFFFF?text=${encodeURIComponent(nft.name || 'NFT')}" alt="NFT ${nft.name || ''}" class="w-full h-full object-cover">
                        </div>
                `;
                container.innerHTML += nftCardHtml;
            });

        } catch (error) {
            console.error("Failed to load NFTs:", error);
            // Ошибка уже показана в apiFetch
            container.innerHTML = '<p class="text-red-500 col-span-2 text-center">Не удалось загрузить NFT.</p>';
        }
    }

    // --- 6. Обработчики действий ---

    // Регистрация / Отмена (делегирование событий)
    document.getElementById('events-container').addEventListener('click', async (e) => {
        const button = e.target.closest('.btn-register');
        if (!button || button.disabled) return; // Игнорируем клики не по кнопкам или по заблокированным

        const eventId = button.dataset.eventId;
        const action = button.dataset.action;
        const originalText = button.textContent; // Сохраняем исходный текст

        button.disabled = true;
        button.textContent = "Обработка...";

        try {
            if (action === 'register') {
                const data = await apiFetch('/api/register', {
                    method: 'POST',
                    body: JSON.stringify({ event_id: eventId })
                });
                if (data.status === 'registered') {
                    if(tg) tg.showAlert(`Вы успешно зарегистрированы на «${data.event_title}»!`);
                } else if (data.status === 'waiting') {
                    if(tg) tg.showAlert(`Места закончились, но вы добавлены в лист ожидания на «${data.event_title}»!`);
                } else {
                    // Обработка already_registered / already_in_waitlist - можно просто перезагрузить
                     console.log(`Registration status: ${data.status}`);
                }
                 await loadEvents(); // Перезагружаем в любом случае
            }
            else if (action === 'unregister') {
                if(tg) {
                    tg.showConfirm("Вы уверены, что хотите отменить регистрацию/запись в лист ожидания?", async (isOk) => {
                        if (isOk) {
                            try {
                                await apiFetch('/api/unregister', {
                                    method: 'POST',
                                    body: JSON.stringify({ event_id: eventId })
                                });
                                tg.showAlert("Регистрация/запись отменена.");
                            } catch(unregisterError){
                                console.error("Unregister failed:", unregisterError);
                                // Ошибка уже показана в apiFetch
                            } finally {
                                await loadEvents(); // Перезагружаем список
                            }
                        } else {
                             button.disabled = false; // Разблокируем кнопку, если пользователь отменил
                             button.textContent = originalText;
                        }
                    });
                } else {
                     // Если нет tg (тестирование в браузере), просто отменяем
                     if(confirm("Вы уверены?")){
                          await apiFetch('/api/unregister', { method: 'POST', body: JSON.stringify({ event_id: eventId }) });
                          await loadEvents();
                     } else {
                          button.disabled = false;
                          button.textContent = originalText;
                     }
                }
            }
            // Не перезагружаем здесь для unregister, т.к. перезагрузка идет внутри showConfirm

        } catch (error) {
            console.error("Action failed:", error);
            // Ошибка уже показана в apiFetch, просто восстанавливаем кнопку
            button.disabled = false;
            button.textContent = originalText;
            // Можно добавить перезагрузку ивентов для синхронизации, если нужно
            // await loadEvents();
        }
    });

    // Кнопка "Мои мероприятия"
    document.getElementById('my-events-button').addEventListener('click', () => {
        // TODO: Реализовать модальное окно или страницу "Мои мероприятия"
        if(tg) tg.showAlert("Раздел 'Мои мероприятия' в разработке.");
        else alert("Раздел 'Мои мероприятия' в разработке.");
    });

    // Кнопка "Мой QR-код"
    document.getElementById('my-qr-button').addEventListener('click', async () => {
        try {
            modalQrImage.src = ""; // Очищаем старый QR
            modalQrImage.alt = "Загрузка QR кода...";
            modal.classList.remove('hidden'); // Показываем модалку сразу

            const data = await apiFetch('/api/my-qr-code');
            const qrData = data.qr_data;

            // Используем публичный API для генерации QR
            const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

            modalQrImage.src = qrImgUrl;
            modalQrImage.alt = "QR Code";

        } catch (error) {
            console.error("Failed to get QR code:", error);
            // Ошибка уже показана в apiFetch
            modal.classList.add('hidden'); // Скрываем модалку, если ошибка
        }
    });

    // Закрытие модального окна QR
    modalClose.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    // Закрытие по клику на фон
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });


    // Запускаем загрузку данных при старте
    loadEvents();
    loadNFTs();
});