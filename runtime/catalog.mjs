// Shared block metadata. Every entry maps to a runtime operation.
const field = (key, label, type = 'text', value = '', options) => ({ key, label, type, default: value, options });
const text = (k,l,v='') => field(k,l,'text',v);
const number = (k,l,v=0) => field(k,l,'number',v);
const json = (k,l,v={}) => field(k,l,'json',JSON.stringify(v,null,2));
const select = (k,l,options,v=options[0]) => field(k,l,'select',v,options);
const target = () => text('user','ID пользователя','{{user.id}}');
const channel = () => text('channel','ID канала','{{channel.id}}');
const reason = () => text('reason','Причина','Действие сценария DBK');
const output = () => text('output','Сохранить результат в temp','result');
const category = (id,title,description,fields=[],ports=['next']) => ({id,title,description,fields,ports});
const events = ['member_join','member_leave','member_update','member_ban','member_unban','member_kick','channel_create','channel_update','channel_delete','role_create','role_update','role_delete','message_create','message_update','message_delete','reaction_add','reaction_remove','voice_update','presence_update','invite_create','invite_delete','emoji_create','emoji_update','emoji_delete','sticker_create','sticker_update','sticker_delete','thread_create','thread_update','thread_delete','scheduled_event_create','scheduled_event_update','scheduled_event_delete','scheduled_event_user_add','scheduled_event_user_remove','stage_create','stage_update','stage_delete','automod_action','audit_log','guild_update','boost','onboarding_complete','socket_message','mqtt_message','webhook_receive','ready'];
export const groups = [
  { id:'triggers', title:'Триггеры', hint:'С чего всё начинается', items:[
    category('trigger.slash','Slash-команда','Команда / в Discord. Опции: string, integer, number, user, channel, role, attachment, boolean.',[text('name','Команда','hello'),text('description','Описание','Поприветствовать участника'),json('options','Опции',[]),text('permission','Необходимое разрешение'),field('ephemeral','Ответ виден только автору','boolean',false)]),
    category('trigger.text','Текстовая команда','Реагирует на префикс или ключевое слово. Нужен Message Content intent.',[text('command','Команда','!hello'),select('match','Совпадение',['starts','equals','contains'])]),
    category('trigger.event','Событие Discord','События участников, сообщений, каналов, ролей и интеграций.',[select('event','Событие',events),text('channel','Фильтр канала (необязательно)')]),
    category('trigger.component','Интерактивный компонент','Нажатие кнопки, выбор меню или отправка формы.',[select('type','Тип',['button','select','modal']),text('customId','Custom ID','hello'),field('ephemeral','Ответ виден только автору','boolean',false)]),
    category('trigger.context','Контекстное меню','Команда Apps при нажатии правой кнопкой на пользователя или сообщение.',[text('name','Название','Информация'),select('type','Тип',['user','message'])]),
    category('trigger.autocomplete','Автокомплит','Подсказки для slash-опции. Завершите блоком «Подсказки».',[text('name','Slash-команда','search')]),
    category('trigger.schedule','Расписание','Cron с часовым поясом или интервал. Работает, пока бот запущен.',[select('mode','Режим',['cron','interval']),text('cron','Cron','0 9 * * *'),text('timezone','Часовой пояс','Europe/Moscow'),number('seconds','Интервал, сек.',60)]),
    category('trigger.function','Функция / сценарий','Вызов из другого сценария. Параметры доступны в {{args}}.',[])
  ]},
  {id:'conditions',title:'Условия',hint:'Два пути для каждого решения',items:[
    category('condition.compare','Сравнение','Сравнивает текст, числа, даты или массивы.',[text('left','Значение','{{temp.result}}'),select('operator','Оператор',['equals','not_equals','greater','less','gte','lte','contains','starts','ends']),text('right','С чем сравнить')],['true','false']),
    category('condition.member','Участник и права','Проверяет роль, разрешение, ID, статус или флаг бота.',[target(),select('check','Проверка',['role','any_role','permission','id','bot','status']),text('value','Роль / разрешение / значение','Administrator')],['true','false']),
    category('condition.channel','Канал','Канал, категория или доступность NSFW.',[select('check','Проверка',['id','category','nsfw']),text('value','Значение')],['true','false']),
    category('condition.chance','Шанс','Случайная ветка с вероятностью от 0 до 100%.',[number('percent','Вероятность, %',30)],['true','false']),
    category('condition.logic','AND / OR / NOT','Комбинирует массив логических значений. Можно подставлять переменные.',[select('operator','Оператор',['AND','OR','NOT']),json('values','Значения',[true,false])],['true','false']),
    category('condition.access','Список доступа','Whitelist или blacklist пользователей, серверов и каналов.',[text('value','Проверяемый ID','{{user.id}}'),select('mode','Режим',['whitelist','blacklist']),json('ids','Список ID',[])],['true','false']),
    category('condition.cooldown','Кулдаун','Атомарное ограничение частоты на пользователя или другой ключ.',[text('key','Ключ','command:{{user.id}}'),number('seconds','Время, сек.',10)],['true','false'])
  ]},
  {id:'messages',title:'Сообщения и компоненты',hint:'Ответы, формы и интерактив',items:[
    category('message.send','Отправить сообщение','Текст, embed, кнопки, select, опрос и вложения в одном сообщении. Упоминания по умолчанию отключены.',[select('mode','Куда',['reply','channel','dm']),channel(),target(),field('content','Текст','textarea','Привет, {{user.username}}!'),json('embeds','Embeds',[]),json('components','Компоненты Discord',[]),json('files','Файлы из папки проекта',[]),json('poll','Опрос',null),field('ephemeral','Личный ответ на команду','boolean',false),output()]),
    category('message.random','Случайный ответ','Выбирает сообщение из списка.',[json('messages','Варианты',['Привет!','Рад тебя видеть!']),output()]),
    category('message.manage','Управление сообщением','Редактирование, удаление, закрепление, публикация, реакции.',[select('action','Действие',['edit','delete','pin','unpin','publish','react','unreact']),channel(),text('message','ID сообщения','{{temp.result.id}}'),field('content','Новый текст','textarea',''),text('emoji','Эмодзи','👍'),output()]),
    category('message.purge','Очистить сообщения','До 100 сообщений за вызов. Старше 14 дней не удаляются массово.',[channel(),number('count','Количество',20),text('user','Только ID пользователя'),output()]),
    category('component.modal','Показать форму','Открывает модальное окно. Должен быть первым действием interaction, до ожиданий.',[text('customId','Custom ID','feedback'),text('title','Заголовок','Обратная связь'),json('fields','Поля',[{id:'text',label:'Ваш отзыв',style:2,required:true}])]),
    category('component.autocomplete','Подсказки','Отвечает на autocomplete, до 25 вариантов.',[json('choices','Варианты',[{name:'Пример',value:'example'}])]),
    category('component.defer','Подтвердить взаимодействие','Подтверждает долгую команду. Для обычных ответов DBK делает это автоматически.',[field('ephemeral','Личный ответ','boolean',false)]),
    category('image.render','Создать изображение','PNG с фоном, изображением и строками текста. Файлы ограничены папкой проекта.',[number('width','Ширина',800),number('height','Высота',300),text('background','Цвет фона','#17191b'),text('image','Локальное фоновое изображение'),json('lines','Надписи',[{text:'Привет, {{user.username}}!',x:40,y:150,size:40,color:'#ffffff'}]),text('file','Имя файла','welcome.png'),output()])
  ]},
  {id:'moderation',title:'Модерация',hint:'Порядок на сервере',items:[
    category('member.moderate','Модерация участника','Kick, ban, unban, timeout и предупреждения в SQLite.',[select('action','Действие',['kick','ban','unban','timeout','untimeout','warn','warnings']),target(),number('minutes','Тайм-аут, мин.',10),reason(),output()]),
    category('role.manage','Управление ролями','Выдать, снять, создать, изменить или удалить роль.',[select('action','Действие',['add','remove','create','edit','delete']),target(),text('role','ID роли (для add/remove через запятую)'),json('data','Параметры роли',{name:'Участник',color:5793266}),reason(),output()]),
    category('channel.manage','Каналы и ветки','Создание и управление каналами, категориями и threads.',[select('action','Действие',['create','edit','delete','thread_create','thread_edit','thread_delete']),channel(),json('data','Параметры',{name:'новый-канал',type:0}),reason(),output()]),
    category('member.voice','Голос участника','Переместить, отключить, mute/deafen участника.',[target(),select('action','Действие',['move','disconnect','mute','unmute','deafen','undeafen']),channel(),reason()])
  ]},
  {id:'data',title:'Переменные и данные',hint:'Память вашего бота',items:[
    category('variable.set','Изменить переменную','Хранит JSON, текст, числа, списки и объекты в SQLite или памяти запуска.',[select('scope','Область',['temp','global','guild','user','channel']),text('key','Имя','balance'),select('operation','Операция',['set','add','subtract','multiply','divide','push','remove','delete']),text('value','Значение','1'),output()]),
    category('variable.get','Получить переменную','Прочитать значение из выбранной области.',[select('scope','Область',['temp','global','guild','user','channel']),text('key','Имя','balance'),text('fallback','По умолчанию','0'),output()]),
    category('data.user','Данные Discord','Получить пользователя, бота, сервер, канал, роль или сформировать упоминание.',[select('entity','Что получить',['user','member','bot','guild','channel','role','mention_user','mention_channel','mention_role']),text('id','ID (пусто = текущий)'),output()]),
    category('data.transform','Преобразование данных','Строки, математика, массивы, JSON, даты, кодирование и хеши.',[select('operation','Операция',['length','trim','upper','lower','replace','split','join','slice','includes','add','subtract','multiply','divide','modulo','power','sqrt','round','floor','ceil','min','max','abs','random','random_item','shuffle','json_parse','json_stringify','get','set','delete','merge','now','date_parse','date_format','date_add','date_diff','base64_encode','base64_decode','url_encode','url_decode','hex_encode','hex_decode','sha256','sha1','md5','uuid']),text('value','Значение','{{temp.result}}'),text('argument','Аргумент'),text('extra','Дополнительно'),output()]),
    category('data.regex','Регулярное выражение','Test, match и replace с ограничением времени выполнения.',[select('operation','Операция',['test','match','replace']),text('pattern','Шаблон','\\d+'),text('flags','Флаги','g'),text('value','Текст'),text('replacement','Замена'),output()]),
    category('data.file','Файлы проекта','Read, write, delete, list, download внутри папки проекта.',[select('operation','Операция',['read','write','delete','list','download']),text('path','Относительный путь','data.txt'),field('value','Содержимое / URL','textarea',''),output()]),
    category('data.sql','SQLite-запрос','Параметризованный запрос к отдельной БД проекта. Параметры задаются массивом.',[field('query','SQL','textarea','SELECT * FROM records LIMIT ?'),json('params','Параметры',[10]),select('mode','Режим',['all','run']),output()]),
    category('data.external','Внешняя база','PostgreSQL, MySQL, Redis или MongoDB. URL берётся из переменной, не сохраняйте пароль в экспортируемой схеме.',[select('driver','База',['postgres','mysql','redis','mongodb']),text('url','URL соединения','{{global.database_url}}'),text('query','SQL / команда Redis / коллекция Mongo'),json('params','Параметры',[]),output()])
  ]},
  {id:'flow',title:'Логика и сценарии',hint:'Большие идеи из простых блоков',items:[
    category('flow.wait','Подождать','Пауза, которую можно отменить остановкой запуска.',[number('ms','Миллисекунды',1000)]),
    category('flow.loop','Цикл','Выполняет ветку «body» для каждого элемента или N раз. {{temp.index}} и {{temp.item}} доступны внутри.',[select('mode','Режим',['count','each']),number('count','Количество',3),text('items','Список','{{temp.items}}')],['body','done']),
    category('flow.break','Прервать цикл','Завершает ближайший цикл.',[],[]),
    category('flow.continue','Следующая итерация','Пропускает оставшиеся действия в цикле.',[],[]),
    category('flow.call','Вызвать сценарий','Запускает отдельный сценарий проекта с параметрами.',[text('scenario','ID сценария'),json('args','Параметры',{}),output()]),
    category('flow.try','Обработка ошибки','Выполняет body, при ошибке идёт в catch, затем done. Ошибка в {{temp.error}}.',[],['body','catch','done']),
    category('flow.stop','Завершить сценарий','Останавливает текущий запуск.',[],[]),
    category('flow.comment','Комментарий','Пояснение, не выполняет действий.',[field('text','Комментарий','textarea','Здесь начинается логика')])
  ]},
  {id:'integrations',title:'Интеграции',hint:'За пределами Discord',items:[
    category('http.request','HTTP / Webhook','GET, POST, PUT, PATCH, DELETE; JSON, заголовки, авторизация. Тайм-аут 15 секунд.',[select('method','Метод',['GET','POST','PUT','PATCH','DELETE']),text('url','URL','https://example.com/api'),json('headers','Заголовки',{}),json('body','Тело',{}),output()]),
    category('socket.connect','WebSocket / MQTT','Постоянное соединение. Входящие сообщения запускают события socket_message или mqtt_message.',[select('protocol','Протокол',['websocket','mqtt']),text('name','Имя соединения','main'),text('url','URL','wss://example.com'),text('topic','MQTT topic','dbk/events'),output()]),
    category('socket.send','Отправить в соединение','Передаёт данные в ранее открытое соединение.',[text('name','Имя','main'),text('topic','MQTT topic','dbk/events'),text('value','Данные','{{temp.result}}')]),
    category('socket.close','Закрыть соединение','Освобождает подключение WebSocket / MQTT.',[text('name','Имя','main')]),
    category('network.send','TCP / UDP','Одноразовая отправка данных с тайм-аутом.',[select('protocol','Протокол',['tcp','udp']),text('host','Хост','127.0.0.1'),number('port','Порт',9000),text('value','Данные'),output()]),
    category('webhook.listen','Входящий webhook','HTTP-сервер на loopback с обязательным секретом. Для внешнего доступа нужен ваш reverse proxy.',[number('port','Порт',8090),text('secret','Секрет','{{global.webhook_secret}}'),output()]),
    category('voice.control','Голос и аудио','Подключение, очередь локальных файлов, pause/resume/stop и отключение. В комплекте FFmpeg.',[select('action','Действие',['join','play','pause','resume','stop','leave','queue']),channel(),text('file','Файл проекта'),output()])
  ]},
  {id:'systems',title:'Готовые системы',hint:'Всё бесплатно, без подписки',items:[
    category('system.xp','Уровни и опыт','Начисляет XP с кулдауном и считает уровень. Результат: xp, level, leveledUp.',[target(),number('amount','XP за действие',15),number('cooldown','Кулдаун, сек.',60),text('rewardRole','Роль за новый уровень'),output()]),
    category('system.economy','Экономика','Баланс, начисление, переводы, ежедневная награда и покупки из каталога.',[select('action','Действие',['balance','add','transfer','daily','buy']),target(),text('recipient','ID получателя'),number('amount','Сумма',100),text('item','ID товара'),json('shop','Каталог',[{id:'vip',name:'VIP-роль',price:1000,roleId:''}]),output()]),
    category('system.ticket','Тикеты','Приватный канал участника с доступом роли поддержки. Закрытие только автором или модератором.',[select('action','Действие',['open','close']),text('category','ID категории'),text('supportRole','ID роли поддержки'),output()]),
    category('system.giveaway','Розыгрыш','Создать, участвовать, завершить. Таймер сохраняется в SQLite, победители выбираются случайно.',[select('action','Действие',['create','enter','end']),text('id','ID розыгрыша','giveaway'),text('prize','Приз','Подарок'),number('minutes','Длительность, мин.',60),number('winners','Победителей',1),text('requiredRole','Обязательная роль'),output()]),
    category('system.roles','Ролевое меню','Выдать/снять роль участника по custom ID кнопки, выбранному значению или реакции.',[json('mapping','ID / эмодзи → ID роли',{'role:news':''}),output()]),
    category('system.automod','Автомодерация','Запрещённые слова, ссылки, спам; удаление и необязательный тайм-аут.',[json('words','Запрещённые слова',[]),field('links','Блокировать ссылки','boolean',false),number('limit','Сообщений за 10 сек.',6),number('timeout','Тайм-аут, мин. (0 = выкл.)',0),output()]),
    category('system.antiraid','Анти-рейд','Ограничение входов за временное окно. Возвращает флаг raid и число входов.',[number('limit','Входов',10),number('seconds','Окно, сек.',30),output()]),
    category('system.stats','Статистика','Считает сообщения, голосовые секунды и события. Используйте соответствующий триггер.',[select('action','Действие',['increment','get']),text('metric','Метрика','messages'),number('amount','Прибавить',1),output()]),
    category('system.reminder','Напоминание','Сохраняет отложенное сообщение в SQLite. После перезапуска просроченное отправляется при запуске бота.',[number('seconds','Через, сек.',60),channel(),text('content','Сообщение','Напоминание!'),output()]),
    category('system.locale','Локализация','Выбирает перевод по локали пользователя/сервера с fallback.',[text('locale','Локаль','{{locale}}'),text('key','Ключ','hello'),text('fallback','Язык по умолчанию','ru'),json('translations','Переводы',{ru:{hello:'Привет!'},en:{hello:'Hello!'}}),output()])
  ]},
  {id:'service',title:'Отладка и служебные',hint:'Наблюдайте за выполнением',items:[
    category('service.log','Запись в журнал','Локальный журнал выполнения, файл и необязательный лог-канал.',[select('level','Уровень',['info','warning','error']),text('message','Сообщение','{{temp.result}}'),text('channel','ID лог-канала'),field('file','Также сохранить в файл','boolean',false)]),
    category('service.assert','Проверка / ошибка','Останавливает ветку ошибкой, если значение ложное. Совместим с Try/Catch.',[text('value','Условие','{{temp.result}}'),text('message','Текст ошибки','Условие не выполнено')]),
    category('service.export','Экспорт данных','Сохраняет массив объектов в JSON или CSV в папку проекта.',[select('format','Формат',['json','csv']),text('value','Данные','{{temp.result}}'),text('file','Имя файла','export'),output()])
  ]}
];
export const catalog = groups.flatMap(g => g.items.map(n => ({...n,group:g.id})));
export const byId = Object.fromEntries(catalog.map(n => [n.id,n]));
export function defaults(kind) { return Object.fromEntries((byId[kind]?.fields || []).map(f => [f.key,f.default])); }
