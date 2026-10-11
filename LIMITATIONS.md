# Limitations & Future Work

## Current Limitations

### Neural Simulation
- **Weight scaling**: Использую `w_scale=0.5`, чтобы избежать runaway activity. MaleCNS имеет ~1.6× больше синапсов на нейрон, чем FlyWire, на котором была откалибрована LIF модель.
- **No synaptic depression**: `std_u=0` для простоты. Short-term depression может предотвратить runaway, но сильно снижает передачу сигнала.
- **Simplified safeguards**: Нет автоматического reset при длительной активности (есть в flybrain live mode).

### Motor Control
- **Simplified physics**: Муха движется по упрощённой модели (forward activation + turn activation), без реалистичного tripod gait.
- **No leg kinematics**: Нет inverse kinematics для ног, как в flybrain 3D fly.
- **Direct rate mapping**: Моторные нейроны напрямую преобразуются в движение, без промежуточных muscle activations.

### Task & Environment
- **Single object**: Только один объект на целевой полке.
- **No object manipulation**: Муха не может захватывать или перемещать объект. Задача — только навигация к правильной полке.
- **Static world**: Полки и объект статичны, нет динамических препятствий.
- **Binary target**: Только две полки (left/right), нет более сложных конфигураций.

### Training
- **Simple policy**: Линейная политика (obs → action), без hidden layers или рекуррентности.
- **Basic ES**: Простая эволюционная стратегия, не CMA-ES.
- **No parallel workers**: Оценка кандидатов последовательная. Можно ускорить через multiprocessing.
- **No curriculum learning**: Сложность задачи фиксирована с начала обучения.

### Visualization
- **No live training stream**: 3D-визуализация пока не показывает live-обучение. HTTP API готов, но trainer не стримит состояние.
- **No brain activity viz**: Нет визуализации активности нейронов (точечное облако есть в flybrain, но здесь не подключено).
- **Static scene**: Браузер опрашивает `/api/state`, но trainer пока не публикует туда данные.

## Next Steps

### Short-term (MVP+)
1. **Live training visualization**
   - Trainer публикует состояние в `SimulationState` через HTTP API
   - Браузер показывает муху в реальном времени во время обучения
   - Добавить metrics: episode return, success rate, generation progress

2. **Improved policy**
   - Добавить hidden layer (простая MLP: obs → hidden → action)
   - Или рекуррентная политика (LSTM/GRU) для учёта истории
   - Попробовать другие RL алгоритмы (PPO, SAC) вместо ES

3. **Object interaction**
   - Стимуляция front-leg descending neurons (DNg12_e) для "reaching"
   - Детекция контакта с объектом
   - Reward за перемещение объекта на целевую полку

### Mid-term
4. **Multiple tasks**
   - Лабиринт с поворотами
   - Несколько объектов разных цветов
   - Sequence tasks (сначала объект A, потом B)

5. **Better motor control**
   - Реалистичный tripod gait через leg motor neurons
   - Inverse kinematics для 3D ног
   - Smooth trajectories

6. **Training efficiency**
   - Параллельные воркеры для ES (multiprocessing)
   - Curriculum learning (начать с близких полок, усложнять)
   - Hyperparameter tuning (sigma, lr, population size)

### Long-term
7. **Advanced RL**
   - PPO или SAC вместо ES
   - Model-based RL (предсказание следующего состояния)
   - Intrinsic motivation (curiosity-driven exploration)

8. **Neuroscience insights**
   - Анализ активных нейронных путей во время успешных эпизодов
   - Визуализация raster plots и population rates
   - Сравнение с биологическими данными (какие пути используются в реальных мухах)

9. **Extensibility**
   - Plugin system для новых задач
   - Custom environments без изменения кода
   - API для внешних алгоритмов обучения

## Known Issues

- **High memory usage during setup**: Конвертация коннектома требует ~4 GB RAM. После конвертации работает с ~1-2 GB.
- **Slow first run**: Загрузка коннектома занимает ~10-15 секунд. Можно кэшировать initialized BrainAdapter, но пока не критично.
- **No error recovery**: Если flybrain данные повреждены, setup.sh не перезагружает их автоматически. Нужно удалить `flybrain/*.feather` и запустить снова.

## Performance Notes

- **Training speed**: ~10-20 episodes/min на M1 Mac (зависит от `step_ms` и `max_steps`)
- **Connectome load**: ~10-15s на первый `BrainAdapter()`
- **ES generation**: ~2-5 минут на generation с population=30, eval_episodes=3

Оптимизация возможна через:
- Параллелизация оценки кандидатов
- Уменьшение `step_ms` (но снизится точность симуляции)
- Кэширование brain state между эпизодами (если seed фиксирован)
