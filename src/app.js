// Variáveis Globais de Estado
let rawData = [];
let filteredData = [];

// Instâncias dos Gráficos Chart.js
let chartTemporal = null;
let chartComposition = null;
let chartRanking = null;

// Instância do Mapa Leaflet
let map = null;
let mapMarkersGroup = null;
let mapInitialized = false;
let raClusters = {};

// Configurações de Estado do Dashboard
let currentMetric = 'abs'; // 'abs' (absoluto) ou 'rate' (taxa por 100k)
let currentYear = 'todos'; // 'todos' ou ano específico (ex: 2024)
let currentRA = 'todas';   // 'todas' ou RA específica
let selectedCrimes = ['Homicídio', 'Latrocínio', 'Lesão Seguida de Morte', 'Feminicídio'];
let rankingOrder = 'top';  // 'top' (mais violentas) ou 'bottom' (menos violentas)
let rankingLimit = '10';   // '10', '15' ou 'all'
let activeTab = 'dashboard'; // 'dashboard' ou 'map'

// Cores do Dashboard (Sincronizadas com o CSS)
const colors = {
    homicidio: '#ff4757',
    latrocinio: '#ffa502',
    lcsm: '#54a0ff',
    feminicidio: '#e056fd',
    accent: '#6c5ce7',
    grid: 'rgba(255, 255, 255, 0.05)',
    tooltipBg: '#121824',
    textMain: '#f1f2f6',
    textMuted: '#8b9bb4'
};

// Coordenadas Geográficas Centrais Estimadas das RAs do Distrito Federal
const raCoordinates = {
    'Águas Claras': [-15.8392, -48.0247],
    'Arniqueira': [-15.8644, -48.0194],
    'Brasília (Plano Piloto)': [-15.7939, -47.8828],
    'Brazlândia': [-15.6678, -48.1994],
    'Candangolândia': [-15.8553, -47.9492],
    'Ceilândia': [-15.8206, -48.1136],
    'Cruzeiro': [-15.7917, -47.9356],
    'Fercal': [-15.5975, -47.8744],
    'Gama': [-16.0205, -48.0647],
    'Guará': [-15.8197, -47.9786],
    'Itapoã': [-15.7486, -47.7761],
    'Jardim Botânico': [-15.8542, -47.7858],
    'Lago Norte': [-15.7336, -47.8686],
    'Lago Sul': [-15.8286, -47.8667],
    'Núcleo Bandeirante': [-15.8767, -47.9658],
    'Paranoá': [-15.7725, -47.7778],
    'Park Way': [-15.8825, -47.9722],
    'Planaltina': [-15.6178, -47.6500],
    'Recanto das Emas': [-15.9022, -48.0678],
    'Riacho Fundo': [-15.8814, -48.0169],
    'Riacho Fundo II': [-15.9031, -48.0314],
    'Samambaia': [-15.8783, -48.0858],
    'Santa Maria': [-16.0125, -48.0078],
    'São Sebastião': [-15.9083, -47.7739],
    'SCIA/Estrutural': [-15.7833, -47.9944],
    'SIA': [-15.7972, -47.9708],
    'Sobradinho': [-15.6500, -47.7900],
    'Sobradinho II': [-15.6178, -47.8183],
    'Sol Nascente/Pôr do Sol': [-15.8361, -48.1344],
    'Sudoeste/Octogonal': [-15.7981, -47.9231],
    'Taguatinga': [-15.8333, -48.0572],
    'Varjão': [-15.7222, -47.8764],
    'Vicente Pires': [-15.7989, -48.0264],
    'Arapoanga': [-15.6264, -47.6897],
    'Água Quente': [-15.9864, -48.2125],
    'Unidades Prisionais': [-15.9753, -47.7533] // Complexo da Papuda (aproximado)
};

// Exibe um banner de notificação customizado (evitando alert() nativo)
function showNotification(message, type = 'info') {
    const banner = document.getElementById('notification-banner');
    const text = document.getElementById('notification-text');
    
    text.textContent = message;
    banner.className = `notification-banner ${type}`;
    banner.classList.remove('hidden');
    
    // Oculta automaticamente após 5 segundos
    setTimeout(() => {
        banner.classList.add('hidden');
    }, 5000);
}

// Configurações Globais do Chart.js para Tema Escuro
const configureChartDefaults = () => {
    Chart.defaults.color = colors.textMuted;
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.labels.color = colors.textMain;
    Chart.defaults.plugins.tooltip.backgroundColor = colors.tooltipBg;
    Chart.defaults.plugins.tooltip.titleColor = colors.textMain;
    Chart.defaults.plugins.tooltip.bodyColor = colors.textMain;
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
};

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    configureChartDefaults();
    loadCSVData();
    setupEventListeners();
});

// Carregamento dos arquivos CSV (Dados de Crimes e Clusters ML)
function loadCSVData() {
    console.log("Iniciando carregamento dos CSVs...");
    Papa.parse('base_final_analitica_df.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            rawData = results.data;
            // Carrega em seguida o arquivo de clusters de Machine Learning
            Papa.parse('dados_cvli_df_clusters.csv', {
                download: true,
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(clusterResults) {
                    console.log("CSV de clusters carregado com sucesso!");
                    clusterResults.data.forEach(row => {
                        raClusters[row.Regiao_Administrativa] = {
                            id: row.Cluster_Id,
                            nome: row.Cluster_Nome
                        };
                    });
                    initDashboard();
                },
                error: function(err) {
                    console.error("Erro ao carregar o CSV de clusters:", err);
                    showNotification("Não foi possível carregar as classificações de Machine Learning (K-Means).", "warning");
                    initDashboard(); // Fallback para carregar o dashboard sem classificação de ML
                }
            });
        },
        error: function(err) {
            console.error("Erro ao carregar o CSV de crimes:", err);
            showNotification("Não foi possível carregar os dados tratados de criminalidade.", "error");
        }
    });
}

// Configuração dos Event Listeners do painel de controle
function setupEventListeners() {
    // Listener do fechar notificação
    document.getElementById('notification-close').addEventListener('click', () => {
        document.getElementById('notification-banner').classList.add('hidden');
    });

    // Alternar entre Absoluto e Taxa
    const btnAbs = document.getElementById('btn-metric-abs');
    const btnRate = document.getElementById('btn-metric-rate');
    
    btnAbs.addEventListener('click', () => {
        if (currentMetric !== 'abs') {
            currentMetric = 'abs';
            btnAbs.classList.add('active');
            btnRate.classList.remove('active');
            updateDashboard();
        }
    });
    
    btnRate.addEventListener('click', () => {
        if (currentMetric !== 'rate') {
            currentMetric = 'rate';
            btnRate.classList.add('active');
            btnAbs.classList.remove('active');
            updateDashboard();
        }
    });

    // Seletor de Ano
    document.getElementById('filter-year').addEventListener('change', (e) => {
        currentYear = e.target.value;
        updateDashboard();
    });

    // Seletor de RA
    document.getElementById('filter-ra').addEventListener('change', (e) => {
        currentRA = e.target.value;
        updateDashboard();
    });

    // Checkboxes de Crime
    const crimeCheckboxes = document.querySelectorAll('.crime-checkbox');
    crimeCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            selectedCrimes = Array.from(crimeCheckboxes)
                .filter(c => c.checked)
                .map(c => c.value);
            
            // Impede desmarcar todos os crimes (força pelo menos 1 selecionado)
            if (selectedCrimes.length === 0) {
                cb.checked = true;
                selectedCrimes = [cb.value];
                showNotification("Por favor, selecione pelo menos um tipo de crime.", "warning");
                return;
            }
            updateDashboard();
        });
    });

    // Ordenação do Ranking (Mais vs Menos violentas)
    const orderBtns = document.querySelectorAll('#ranking-order-toggle .control-btn');
    orderBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            orderBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            rankingOrder = btn.dataset.order;
            updateRankingChart();
        });
    });

    // Limite do Ranking (Top 10, 15, Todas)
    document.getElementById('ranking-limit').addEventListener('change', (e) => {
        rankingLimit = e.target.value;
        updateRankingChart();
    });

    // Navegação de Abas (Tabs)
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

// Controla a troca de abas
function switchTab(tabName) {
    if (activeTab === tabName) return;
    
    activeTab = tabName;
    
    // Atualiza botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Atualiza conteúdos das abas
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(`tab-${tabName}-content`);
    if (targetContent) targetContent.classList.add('active');
    
    // Lógica específica da aba de mapa
    if (tabName === 'map') {
        if (!mapInitialized) {
            initMap();
        }
        // Leaflet precisa recalcular seu container quando exibido de um estado oculto
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                updateMap();
            }
        }, 100);
    }
}

// Inicializa os dropdowns na primeira carga de dados
function initDashboard() {
    // 1. Popular Dropdown de RAs
    const raSelect = document.getElementById('filter-ra');
    
    const ras = [...new Set(rawData.map(item => item.Regiao_Administrativa))]
        .filter(Boolean)
        .filter(ra => ra !== 'Unidades Prisionais')
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        
    ras.push('Unidades Prisionais');
    
    ras.forEach(ra => {
        const option = document.createElement('option');
        option.value = ra;
        option.textContent = ra;
        raSelect.appendChild(option);
    });

    // 2. Renderizar Gráficos Iniciais vazios
    renderCharts();
    
    // 3. Atualizar Dashboard
    updateDashboard();
}

// Calcula população ativa no filtro (evita duplicações)
function getActivePopulation(dataSubset) {
    const raPopMap = {};
    dataSubset.forEach(item => {
        raPopMap[item.Regiao_Administrativa] = item.Populacao || 0;
    });
    return Object.values(raPopMap).reduce((sum, pop) => sum + pop, 0);
}

// Atualiza o estado dos dados e reflete nos KPIs e Gráficos
function updateDashboard() {
    // 1. Filtrar dados principais com base nas seleções
    filteredData = rawData.filter(item => {
        // Filtro de RA
        const matchRA = (currentRA === 'todas') || (item.Regiao_Administrativa === currentRA);
        
        // Filtro de Ano
        const matchYear = (currentYear === 'todos') || (String(item.Ano) === String(currentYear));
        
        // Filtro de Tipo de Crime
        const matchCrime = selectedCrimes.includes(item.Tipo_Crime);
        
        return matchRA && matchYear && matchCrime;
    });

    const numYears = currentYear === 'todos' ? 10 : 1;

    // 2. Atualizar KPIs
    updateKPIs(numYears);

    // 3. Atualizar os Gráficos
    updateTemporalChart();
    updateCompositionChart();
    updateRankingChart();

    // 4. Atualizar Mapa se estiver ativo e já inicializado
    if (activeTab === 'map' && map) {
        updateMap();
    }
}

// Atualiza os cartões de KPI
function updateKPIs(numYears) {
    const totalVictims = filteredData.reduce((sum, item) => sum + item.Qtd_Vitimas, 0);
    const activePop = getActivePopulation(filteredData);
    
    // Taxa CVLI Anualizada por 100k hab.
    const rateVal = activePop > 0 ? ((totalVictims / numYears) / activePop) * 100000 : 0;

    const totalValEl = document.getElementById('kpi-total-val');
    const rateValEl = document.getElementById('kpi-rate-val');

    totalValEl.textContent = totalVictims.toLocaleString('pt-BR');
    rateValEl.textContent = rateVal.toFixed(1).replace('.', ',');

    // Cálculo de Variação Anual (%) vs Ano Anterior
    const comparisonData = rawData.filter(item => {
        const matchRA = (currentRA === 'todas') || (item.Regiao_Administrativa === currentRA);
        const matchCrime = selectedCrimes.includes(item.Tipo_Crime);
        return matchRA && matchCrime;
    });

    const totalTrendEl = document.getElementById('kpi-total-trend');
    const rateTrendEl = document.getElementById('kpi-rate-trend');
    const totalFooterEl = document.getElementById('kpi-total-footer-text');
    const rateFooterEl = document.getElementById('kpi-rate-footer-text');

    if (currentYear === 'todos') {
        // Oculta os indicadores de tendência para o período consolidado
        totalTrendEl.classList.add('hidden');
        rateTrendEl.classList.add('hidden');
        // Atualiza textos do rodapé para refletir o período completo
        totalFooterEl.textContent = 'Série de 10 anos (2015-2024)';
        rateFooterEl.textContent = 'Média anual do período';
    } else {
        // Exibe os indicadores de tendência e reseta o texto
        totalTrendEl.classList.remove('hidden');
        rateTrendEl.classList.remove('hidden');
        totalFooterEl.textContent = 'vs ano anterior';
        rateFooterEl.textContent = 'vs ano anterior';

        const targetYear = parseInt(currentYear);
        const prevYear = targetYear - 1;

        if (targetYear === 2015) {
            totalTrendEl.className = "kpi-trend trend-down";
            rateTrendEl.className = "kpi-trend trend-down";
            document.getElementById('kpi-total-trend-val').textContent = "N/A";
            document.getElementById('kpi-rate-trend-val').textContent = "N/A";
        } else {
            const targetYearVictims = comparisonData.filter(item => item.Ano === targetYear).reduce((sum, item) => sum + item.Qtd_Vitimas, 0);
            const prevYearVictims = comparisonData.filter(item => item.Ano === prevYear).reduce((sum, item) => sum + item.Qtd_Vitimas, 0);

            let pctChange = 0;
            if (prevYearVictims > 0) {
                pctChange = ((targetYearVictims - prevYearVictims) / prevYearVictims) * 100;
            } else if (targetYearVictims > 0) {
                pctChange = 100;
            }

            const isDown = pctChange <= 0;
            const trendClass = isDown ? "trend-down" : "trend-up";
            const symbol = pctChange > 0 ? "+" : "";
            
            totalTrendEl.className = `kpi-trend ${trendClass}`;
            rateTrendEl.className = `kpi-trend ${trendClass}`;
            
            const formattedChange = `${symbol}${pctChange.toFixed(1).replace('.', ',')}%`;
            document.getElementById('kpi-total-trend-val').textContent = formattedChange;
            document.getElementById('kpi-rate-trend-val').textContent = formattedChange;
        }
    }

    // Crime Predominante
    const crimeCounts = {};
    selectedCrimes.forEach(c => crimeCounts[c] = 0);
    filteredData.forEach(item => {
        crimeCounts[item.Tipo_Crime] = (crimeCounts[item.Tipo_Crime] || 0) + item.Qtd_Vitimas;
    });

    let dominantCrime = "Nenhum";
    let dominantCount = 0;
    Object.keys(crimeCounts).forEach(c => {
        if (crimeCounts[c] > dominantCount) {
            dominantCount = crimeCounts[c];
            dominantCrime = c;
        }
    });

    const dominantPct = totalVictims > 0 ? ((dominantCount / totalVictims) * 100) : 0;
    document.getElementById('kpi-dominant-val').textContent = dominantCrime;
    document.getElementById('kpi-dominant-pct').textContent = `${dominantPct.toFixed(1).replace('.', ',')}%`;

    // Região Mais Violenta
    const raAgg = {};
    filteredData.forEach(item => {
        const ra = item.Regiao_Administrativa;
        if (!raAgg[ra]) {
            raAgg[ra] = { victims: 0, pop: item.Populacao };
        }
        raAgg[ra].victims += item.Qtd_Vitimas;
    });

    let highestRA = "Nenhuma";
    let highestValue = -1;

    Object.keys(raAgg).forEach(ra => {
        if (ra === 'Unidades Prisionais') return;
        
        let value = 0;
        if (currentMetric === 'abs') {
            value = raAgg[ra].victims;
        } else {
            value = raAgg[ra].pop > 0 ? ((raAgg[ra].victims / numYears) / raAgg[ra].pop) * 100000 : 0;
        }

        if (value > highestValue) {
            highestValue = value;
            highestRA = ra;
        }
    });

    document.getElementById('kpi-highest-ra-val').textContent = highestRA;
    
    if (currentMetric === 'abs') {
        document.getElementById('kpi-highest-ra-stat').textContent = highestValue.toLocaleString('pt-BR');
        document.getElementById('kpi-highest-ra-label').textContent = "ocorrências";
    } else {
        document.getElementById('kpi-highest-ra-stat').textContent = highestValue.toFixed(1).replace('.', ',');
        document.getElementById('kpi-highest-ra-label').textContent = "taxa por 100k hab";
    }
}

// Inicializa a renderização base dos três gráficos com objetos vazios
function renderCharts() {
    // --- 1. GRÁFICO DE LINHA (TEMPORAL) ---
    const ctxTemporal = document.getElementById('chart-temporal-canvas').getContext('2d');
    chartTemporal = new Chart(ctxTemporal, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, pointStyle: 'circle', padding: 15 }
                }
            },
            scales: {
                x: { grid: { color: colors.grid, drawBorder: false }, ticks: { color: colors.textMuted } },
                y: {
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.textMuted },
                    title: { display: true, text: 'Quantidade de Vítimas', color: colors.textMuted }
                }
            }
        }
    });

    // --- 2. GRÁFICO DE ROSCA (COMPOSIÇÃO) ---
    const ctxComposition = document.getElementById('chart-composition-canvas').getContext('2d');
    chartComposition = new Chart(ctxComposition, {
        type: 'doughnut',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, pointStyle: 'circle', padding: 15 }
                }
            }
        }
    });

    // --- 3. GRÁFICO DE BARRAS (RANKING RA) ---
    const ctxRanking = document.getElementById('chart-ranking-canvas').getContext('2d');
    chartRanking = new Chart(ctxRanking, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: colors.grid, drawBorder: false }, ticks: { color: colors.textMuted } },
                y: { grid: { display: false }, ticks: { color: colors.textMain, font: { weight: '600' } } }
            }
        }
    });
}

// Atualiza o Gráfico de Evolução Temporal
function updateTemporalChart() {
    const anosArray = Array.from({ length: 10 }, (_, i) => 2015 + i);
    
    // Filtra série temporal ignorando o filtro de ano atual
    const tempSubset = rawData.filter(item => {
        const matchRA = (currentRA === 'todas') || (item.Regiao_Administrativa === currentRA);
        const matchCrime = selectedCrimes.includes(item.Tipo_Crime);
        return matchRA && matchCrime;
    });

    const datasetsMap = {};
    selectedCrimes.forEach(crime => {
        datasetsMap[crime] = Array(10).fill(0);
    });
    
    const totalSeries = Array(10).fill(0);

    tempSubset.forEach(item => {
        const idx = item.Ano - 2015;
        if (idx >= 0 && idx < 10) {
            let val = item.Qtd_Vitimas;
            if (currentMetric === 'rate') {
                const pop = getActivePopulation(tempSubset.filter(i => i.Ano === item.Ano));
                val = pop > 0 ? (item.Qtd_Vitimas / pop) * 100000 : 0;
            }
            datasetsMap[item.Tipo_Crime][idx] += val;
        }
    });

    for (let idx = 0; idx < 10; idx++) {
        let sum = 0;
        selectedCrimes.forEach(crime => {
            sum += datasetsMap[crime][idx];
        });
        totalSeries[idx] = sum;
    }

    const datasets = [];
    const crimeColors = {
        'Homicídio': colors.homicidio,
        'Latrocínio': colors.latrocinio,
        'Lesão Seguida de Morte': colors.lcsm,
        'Feminicídio': colors.feminicidio
    };

    selectedCrimes.forEach(crime => {
        datasets.push({
            label: crime,
            data: datasetsMap[crime],
            borderColor: crimeColors[crime],
            backgroundColor: crimeColors[crime] + '22',
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: false
        });
    });

    if (selectedCrimes.length > 1) {
        datasets.push({
            label: 'Total CVLI Selecionado',
            data: totalSeries,
            borderColor: colors.textMain,
            backgroundColor: 'transparent',
            tension: 0.35,
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 4,
            pointHoverRadius: 7,
            fill: false
        });
    }

    chartTemporal.data.labels = anosArray;
    chartTemporal.data.datasets = datasets;
    
    chartTemporal.options.scales.y.title.text = currentMetric === 'abs' 
        ? 'Quantidade de Vítimas' 
        : 'Taxa CVLI por 100k Habitantes';
        
    chartTemporal.update();
}

// Atualiza o Gráfico de Rosca de Composição de Crimes
function updateCompositionChart() {
    const counts = {};
    selectedCrimes.forEach(crime => counts[crime] = 0);

    filteredData.forEach(item => {
        counts[item.Tipo_Crime] += item.Qtd_Vitimas;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const crimeColors = [colors.homicidio, colors.latrocinio, colors.lcsm, colors.feminicidio];

    chartComposition.data.labels = labels;
    chartComposition.data.datasets = [{
        data: data,
        backgroundColor: crimeColors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#121824',
        hoverOffset: 15
    }];
    chartComposition.update();
}

// Atualiza o Ranking de RAs (Gráfico de Barras)
function updateRankingChart() {
    const raData = {};
    filteredData.forEach(item => {
        const ra = item.Regiao_Administrativa;
        if (!raData[ra]) {
            raData[ra] = { victims: 0, pop: item.Populacao };
        }
        raData[ra].victims += item.Qtd_Vitimas;
    });

    const numYears = currentYear === 'todos' ? 10 : 1;
    const items = [];

    Object.keys(raData).forEach(ra => {
        let val = 0;
        if (currentMetric === 'abs') {
            val = raData[ra].victims;
        } else {
            val = raData[ra].pop > 0 ? ((raData[ra].victims / numYears) / raData[ra].pop) * 100000 : 0;
        }
        items.push({ ra: ra, value: val });
    });

    if (rankingOrder === 'top') {
        items.sort((a, b) => b.value - a.value);
    } else {
        items.sort((a, b) => a.value - b.value);
    }

    let finalItems = rankingLimit === 'all' ? items : items.slice(0, parseInt(rankingLimit));

    const labels = finalItems.map(i => i.ra);
    const values = finalItems.map(i => i.value);

    const rankingTitleEl = document.getElementById('ranking-chart-title');
    const orderText = rankingOrder === 'top' ? 'Mais Violentas' : 'Menos Violentas';
    const metricText = currentMetric === 'abs' ? 'em Valores Absolutos' : 'pela Taxa por 100k Habitantes';
    rankingTitleEl.textContent = `Ranking RAs: ${orderText} (${metricText})`;

    const barBgColor = currentMetric === 'abs' ? 'rgba(108, 92, 231, 0.85)' : 'rgba(224, 86, 253, 0.85)';
    const barHoverBgColor = currentMetric === 'abs' ? '#6c5ce7' : '#e056fd';

    chartRanking.data.labels = labels;
    chartRanking.data.datasets = [{
        data: values,
        backgroundColor: barBgColor,
        hoverBackgroundColor: barHoverBgColor,
        borderRadius: 5,
        borderWidth: 0,
        barThickness: 16
    }];
    
    chartRanking.options.scales.x.title = {
        display: true,
        text: currentMetric === 'abs' ? 'Vítimas Totais' : 'Taxa por 100k Habitantes',
        color: colors.textMuted
    };

    chartRanking.update();
}

// ==========================================================================
// MAPA INTERATIVO (LEAFLET E PONTOS DE RAs)
// ==========================================================================

// Inicializa o Leaflet Map
function initMap() {
    if (mapInitialized) return;
    
    console.log("Inicializando Leaflet Map com tema escuro...");
    
    // Configura o mapa centrado no Distrito Federal
    map = L.map('map-container', {
        zoomSnap: 0.25,
        zoomDelta: 0.5
    }).setView([-15.783, -47.93], 10);
    
    // Adiciona camada Dark Matter do CartoDB (Visualização Premium Escura)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Grupo de marcadores
    mapMarkersGroup = L.layerGroup().addTo(map);
    mapInitialized = true;
}

// Cria uma linha (linha chave/valor) de informação de forma segura contra XSS
function createPopupRow(labelText, valueText) {
    const row = document.createElement('div');
    row.className = 'map-popup-row';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'map-popup-label';
    labelSpan.textContent = labelText;
    
    const valSpan = document.createElement('span');
    valSpan.className = 'map-popup-val';
    valSpan.textContent = valueText;
    
    row.appendChild(labelSpan);
    row.appendChild(valSpan);
    return row;
}

// Atualiza marcadores do mapa com base nos filtros
function updateMap() {
    if (!mapInitialized || !map) return;
    
    mapMarkersGroup.clearLayers();
    
    // Atualiza o texto da legenda do mapa
    const mapMetricEl = document.getElementById('map-active-metric');
    if (mapMetricEl) {
        mapMetricEl.textContent = currentMetric === 'abs' 
            ? 'Exibindo: Números Absolutos' 
            : 'Exibindo: Taxa por 100k Habitantes';
    }

    // Agrupa dados por RA com base no filtro ativo (ano e crimes selecionados)
    const raAgg = {};
    filteredData.forEach(item => {
        const ra = item.Regiao_Administrativa;
        if (!raAgg[ra]) {
            raAgg[ra] = { victims: 0, pop: item.Populacao };
        }
        raAgg[ra].victims += item.Qtd_Vitimas;
    });

    const numYears = currentYear === 'todos' ? 10 : 1;

    // Adiciona círculos proporcionais para as RAs configuradas
    Object.keys(raCoordinates).forEach(raName => {
        const coords = raCoordinates[raName];
        const raInfo = raAgg[raName] || { victims: 0, pop: 0 };
        
        const victims = raInfo.victims;
        const pop = raInfo.pop;
        const rate = pop > 0 ? ((victims / numYears) / pop) * 100000 : 0;
        
        let displayValue = 0;
        let radius = 0;
        
        // Define o tamanho da bolha proporcionalmente
        if (currentMetric === 'abs') {
            displayValue = victims;
            // Escala não linear para melhor ajuste de círculos
            radius = Math.sqrt(victims) * 2.2 + 5;
        } else {
            displayValue = rate;
            radius = Math.sqrt(rate) * 3.5 + 5;
        }

        // Limita o raio para evitar círculos gigantes ou invisíveis
        radius = Math.max(5, Math.min(45, radius));

        // Determina a cor com base no agrupamento de Machine Learning (K-Means)
        const clusterInfo = raClusters[raName] || { id: -1, nome: 'Não Classificado (Especial)' };
        let color = colors.lcsm; // Padrão para não classificado (Azul)
        if (clusterInfo.id === 2) {
            color = colors.homicidio; // Vermelho (Alto Risco)
        } else if (clusterInfo.id === 1) {
            color = colors.latrocinio; // Laranja (Médio Risco)
        } else if (clusterInfo.id === 0) {
            color = colors.accent; // Indigo/Roxo (Baixo Risco)
        }

        // Criação do marcador circular
        const circle = L.circleMarker(coords, {
            radius: radius,
            fillColor: color,
            color: '#ffffff',
            weight: 1.2,
            opacity: 0.85,
            fillOpacity: 0.65
        });

        // CONSTRUÇÃO SEGURA DO POPUP CONTRA XSS (Guidelines Seguras DOM)
        const popupContent = document.createElement('div');
        
        const popupTitle = document.createElement('div');
        popupTitle.className = 'map-popup-title';
        popupTitle.textContent = raName;
        popupContent.appendChild(popupTitle);

        // Linha População
        const popText = pop > 0 ? pop.toLocaleString('pt-BR') : 'N/A';
        popupContent.appendChild(createPopupRow('População (2024):', popText));

        // Linha Vítimas
        popupContent.appendChild(createPopupRow('Vítimas no Filtro:', victims.toLocaleString('pt-BR')));

        // Linha Taxa
        const rateText = pop > 0 
            ? `${rate.toFixed(1).replace('.', ',')} / 100k` 
            : 'N/A';
        popupContent.appendChild(createPopupRow('Taxa CVLI (Anual):', rateText));

        // Busca dados socioeconômicos estáticos (PDAD 2021) da RA em rawData
        const raRow = rawData.find(item => item.Regiao_Administrativa === raName);
        const renda = raRow ? raRow.Renda_Per_Capita : null;
        const idadeMedia = raRow ? raRow.Idade_Media : null;
        const pmPerc = raRow ? raRow.Policiamento_Militar_Perc : null;
        const segPrivPerc = raRow ? raRow.Seguranca_Privada_Perc : null;
        const segComPerc = raRow ? raRow.Seguranca_Comunitaria_Perc : null;

        const rendaText = (renda !== null && renda !== undefined && !isNaN(renda))
            ? `R$ ${renda.toFixed(2).replace('.', ',')}`
            : 'N/A';
        popupContent.appendChild(createPopupRow('Renda p/ Capita:', rendaText));

        const idadeText = (idadeMedia !== null && idadeMedia !== undefined && !isNaN(idadeMedia))
            ? `${idadeMedia.toFixed(1).replace('.', ',')} anos`
            : 'N/A';
        popupContent.appendChild(createPopupRow('Idade Média:', idadeText));

        const pmText = (pmPerc !== null && pmPerc !== undefined && !isNaN(pmPerc))
            ? `${pmPerc.toFixed(1).replace('.', ',')}%`
            : 'N/A';
        popupContent.appendChild(createPopupRow('Policiamento Militar:', pmText));

        const segPrivText = (segPrivPerc !== null && segPrivPerc !== undefined && !isNaN(segPrivPerc))
            ? `${segPrivPerc.toFixed(1).replace('.', ',')}%`
            : 'N/A';
        popupContent.appendChild(createPopupRow('Segurança Privada:', segPrivText));

        const segComText = (segComPerc !== null && segComPerc !== undefined && !isNaN(segComPerc))
            ? `${segComPerc.toFixed(1).replace('.', ',')}%`
            : 'N/A';
        popupContent.appendChild(createPopupRow('Segurança Comunitária:', segComText));

        // Linha Perfil de Risco (ML K-Means)
        popupContent.appendChild(createPopupRow('Perfil de Risco (K-Means):', clusterInfo.nome));

        // Botão de ação do popup
        const actionBtn = document.createElement('button');
        actionBtn.className = 'map-popup-btn';
        
        const filterIcon = document.createElement('i');
        filterIcon.className = 'fa-solid fa-arrow-right-to-bracket';
        actionBtn.appendChild(filterIcon);
        
        const btnText = document.createTextNode(' Ver Detalhes no Dashboard');
        actionBtn.appendChild(btnText);

        // Ação de clicar no botão: Aplica o filtro de RA e redireciona
        actionBtn.addEventListener('click', () => {
            // Atualiza o seletor no sidebar
            const selectEl = document.getElementById('filter-ra');
            if (selectEl) {
                selectEl.value = raName;
                currentRA = raName;
            }
            
            circle.closePopup();
            
            // Retorna à aba do Dashboard e atualiza tudo
            switchTab('dashboard');
            updateDashboard();
        });

        popupContent.appendChild(actionBtn);

        // Associa popup ao círculo
        circle.bindPopup(popupContent);
        
        // Efeito simples de mouseover/mouseout
        circle.on('mouseover', function (e) {
            this.setStyle({
                fillOpacity: 0.85,
                weight: 2
            });
        });
        circle.on('mouseout', function (e) {
            this.setStyle({
                fillOpacity: 0.65,
                weight: 1.2
            });
        });

        mapMarkersGroup.addLayer(circle);
    });
}
