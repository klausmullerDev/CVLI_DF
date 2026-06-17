# Relatório Metodológico: Ciência de Dados aplicada ao CVLI/DF (2015-2024)

Este documento detalha o raciocínio analítico, as decisões de engenharia de dados e as escolhas estatísticas adotadas no desenvolvimento do Dashboard de Crimes Violentos Letais Intencionais (CVLI) no Distrito Federal. Ele serve como guia de defesa acadêmica para a matéria de **Ciência de Dados**.

---

## 1. Engenharia de Dados: O Processo ETL (*Extract, Transform, Load*)

Os dados brutos fornecidos pela SSP/DF estavam em formato de **matriz horizontal** (Anos nas colunas e Regiões Administrativas nas linhas), o que é ideal para leitura humana em relatórios impressos, mas altamente inadequado para bancos de dados analíticos. 

Aplicamos o processo ETL utilizando Python e Pandas com o seguinte raciocínio:

### A. Conversão para *Tidy Data* (Dados Organizados)
Segundo os princípios de Hadley Wickham (criador do conceito de *Tidy Data*):
1. Cada variável deve formar uma coluna.
2. Cada observação deve formar uma linha.
3. Cada tipo de unidade observacional deve formar uma tabela.

No formato original, a variável "Ano" estava espalhada por 10 colunas (2015 a 2024). Usamos a técnica de **Unpivot** (função `melt` do Pandas) para rotacionar a matriz, consolidando todos os anos em uma única coluna chamada `Ano` e as contagens em `Qtd_Vitimas`. Isso permite filtros dinâmicos e agregações em ferramentas de BI ou Javascript de forma simples.

### B. Limpeza de Ruídos e Agregados
- **Remoção de Linhas Iniciais (Skiprows):** Cada planilha de crime possuía títulos, subtítulos ou células mescladas de tamanhos diferentes no topo. Identificamos os offsets corretos (`skiprows=4` para Homicídio, `5` para Latrocínio, `2` para LCSM e Feminicídio) para carregar diretamente a linha que continha os cabeçalhos das colunas.
- **Filtragem de Agregados Totais:** Removemos a linha correspondente ao total do "Distrito Federal". Se deixássemos o total geral na mesma coluna que as RAs, qualquer soma global (`SUM`) no Dashboard duplicaria os dados (somando o total com as partes). Os totais devem ser calculados dinamicamente.
- **Substituição de Caracteres Especiais:** Hífens (`-`) e asteriscos (`*`) eram usados nas planilhas para indicar "zero ocorrências" ou "variação não calculável". O Pandas lê esses caracteres como texto (`string`), o que impediria operações matemáticas nas colunas. Substituímos esses caracteres pelo valor numérico `0` e convertemos as colunas para o tipo inteiro (`int`).

### C. Grid de Integridade de Dados (Produto Cartesiano)
Um problema comum em bases concatenadas é a ausência de registros para RAs que não tiveram ocorrências de determinado crime. Por exemplo, se a RA *SIA* nunca teve um Latrocínio, o arquivo original simplesmente não lista a linha do *SIA* ou deixa-a vazia. Ao carregar isso no gráfico, haveria "buracos" na série histórica.

Para resolver isso, construímos um **Grid de Integridade**:
1. Extraímos o conjunto único de todas as 36 RAs (incluindo as novas e unidades prisionais) e de todos os 10 anos.
2. Geramos o produto cartesiano das combinações possíveis: `36 RAs × 10 Anos × 4 Crimes = 1.440 linhas`.
3. Mesclamos os dados reais de crimes sobre esse grid vazio utilizando um `left join`. Onde não havia dados correspondentes, preenchemos com `0`.
4. Isso garante consistência estatística: **toda RA possui dados para todos os anos e todos os crimes**, evitando erros de renderização ou valores nulos (`NaN`) na interface.

---

## 2. Cruzamento Demográfico e Ajuste de Escala

Exibir apenas números absolutos de crimes gera uma distorção analítica chamada **viés populacional**. Regiões densamente povoadas, como *Ceilândia* (~299 mil hab.), naturalmente registrarão mais ocorrências do que regiões menores, como o *Varjão* (~9 mil hab.), mesmo que o Varjão seja estatisticamente mais violento em termos proporcionais.

### A. Mapeamento das Chaves Geográficas (Join)
Cruzamos os dados consolidados de crimes com a tabela de população estimada extraída da aba `População` do arquivo de feminicídio. Tivemos que tratar divergências de nomenclatura de dados de fontes diferentes:
- `Plano Piloto` no censo foi normalizado para `Brasília (Plano Piloto)`.
- `N. Bandeirante` foi normalizado para `Núcleo Bandeirante`.
- `Sol Nascente e Pôr do Sol` foi normalizado para `Sol Nascente/Pôr do Sol`.
- `Sudoeste e Octogonal` foi normalizado para `Sudoeste/Octogonal`.

### B. Integração de Regiões Especiais
- **Unidades Prisionais:** Crimes cometidos em presídios aparecem na série histórica, mas essa categoria não possui população residente no censo do IBGE. Mantivemos esses crimes para não subestimar o total do Distrito Federal, mapeando sua população como `0`.
- **Novas RAs (Arapoanga e Água Quente):** Criadas recentemente, elas possuem população estimada no censo de 2024, mas poucos ou nenhum dado na série histórica de crimes (pois antes eram registradas sob a tutela de suas RAs "mães", Planaltina e Recanto das Emas). O grid manteve essas RAs com zero crimes históricos, preparando a base para receber futuros dados de 2025 adiante.

---

## 3. Métricas Estatísticas e Métodos de Cálculo

Explicar a matemática por trás dos cartões de KPI e gráficos é fundamental para a defesa do trabalho:

### A. Métrica 1: Número Absoluto
Representa a contagem pura de vítimas. É útil para planejamento de alocação de recursos físicos (ex: saber onde a demanda de necrotérios ou viaturas é maior em termos de volume de trabalho).

### B. Métrica 2: Taxa por 100 mil Habitantes (Fórmula Anualizada)
É a métrica padrão ouro em criminologia comparativa. Ela calcula o risco relativo de um cidadão ser vítima de crime violento naquela região.

$$Taxa = \left( \frac{\text{Total de Vítimas no Período}}{\text{Número de Anos}} \right) \div \text{População da Região} \times 100.000$$

**Por que dividimos pelo "Número de Anos" (Anualização)?**
Se selecionarmos o filtro "Todos os Anos" (2015-2024), estaremos somando as vítimas de 10 anos. Se não dividíssemos por 10, a taxa representaria a probabilidade acumulada de uma década, dando a falsa impressão de que a taxa de criminalidade é 10 vezes maior do que a taxa média anual. Ao dividir pelo número de anos selecionados, a taxa permanece anualizada e comparável.

### C. Métrica 3: Variação Percentual Anual (YoY - *Year over Year*)
Calcula a tendência de crescimento ou redução comparando o ano selecionado com o ano imediatamente anterior.

$$\text{Variação (\%)} = \left( \frac{\text{Vítimas}_{\text{Ano Alvo}} - \text{Vítimas}_{\text{Ano Anterior}}}{\text{Vítimas}_{\text{Ano Anterior}}} \right) \times 100$$

- Se o resultado for negativo (ex: `-15.4%`), indica uma **queda** na violência.
- Tratamento de exceções: Se as vítimas do ano anterior forem `0`, a divisão por zero é tratada para retornar `100%` caso haja vítimas no ano alvo, ou `0%` caso continue zerado.

---

## 4. Escolhas de Visualização e Cartografia Temática

### A. Representação no Mapa (Por que a Raiz Quadrada?)
No mapa interativo, representamos a gravidade do crime através do raio de círculos desenhados sobre as RAs. No JavaScript, o cálculo do raio foi programado usando a **raiz quadrada** do valor:

$$\text{Raio} = \sqrt{\text{Valor Métrica}} \times \text{Fator de Escala} + \text{Tamanho Mínimo}$$

**Explicação Científica (Design de Informação):**
A área de um círculo é calculada por $A = \pi \cdot r^2$. 
Se escalarmos o raio ($r$) de forma linear em relação ao valor da métrica (ex: duplicar o raio quando o valor duplica), a **área visual** do círculo aumentará quatro vezes ($2^2$). Isso cria uma distorção perceptiva severa para o usuário, fazendo RAs com muitos crimes parecerem desproporcionalmente gigantes. Extrair a raiz quadrada antes de definir o raio garante que a área visual da bolha cresça de forma estritamente proporcional ao valor numérico real.

### B. Cores de Alerta (Sinalização Cognitiva)
Utilizamos uma paleta de calor baseada nas cores:
- **Lilás/Indigo (Baixo Risco):** Cores frias para acalmar a leitura visual e destacar as regiões seguras.
- **Laranja (Médio Risco):** Cor quente de transição para prender a atenção.
- **Vermelho (Alto Risco):** Cor quente saturada para sinalizar zonas críticas instantaneamente.

---

## 5. Inteligência Artificial: Agrupamento de Risco com Machine Learning (K-Means)

Para classificar as RAs de forma inteligente e livre de vieses subjetivos humanos, incorporamos um modelo de **Aprendizado de Máquina Não Supervisionado (Machine Learning)** utilizando o algoritmo **K-Means**.

### A. Seleção e Engenharia de Features
O modelo analisa o perfil multidimensional de criminalidade de cada RA. As características (*features*) utilizadas para agrupar as RAs são as **taxas médias anualizadas de ocorrências por 100 mil habitantes** (calculadas na série histórica de 10 anos) para cada um dos quatro tipos de crimes:
- Taxa Anual de Homicídios por 100k hab.
- Taxa Anual de Latrocínios por 100k hab.
- Taxa Anual de Lesões Seguidas de Morte por 100k hab.
- Taxa Anual de Feminicídios por 100k hab.

Ao focar nas taxas por 100k (em vez de números absolutos), garantimos que o tamanho populacional da RA não interfira na categorização de perfil de risco criminoso.

### B. Padronização de Características (Feature Scaling)
O K-Means calcula a similaridade entre as observações com base na **distância euclidiana** em um espaço n-dimensional:

$$d(p, q) = \sqrt{\sum_{i=1}^n (q_i - p_i)^2}$$

Se as variáveis tivessem escalas muito distintas (ex: a taxa de homicídios variando de 0 a 50, enquanto feminicídios variam de 0 a 5), a variável com maior magnitude dominaria o cálculo da distância, tornando as outras variáveis insignificantes. Para evitar isso, aplicamos a padronização **`StandardScaler`** do `scikit-learn`:

$$z = \frac{x - \mu}{\sigma}$$

Isso transforma cada variável de forma que sua média seja $0$ e seu desvio padrão seja $1$, garantindo peso idêntico para todas no agrupamento.

### C. Execução do Algoritmo e Validação (Silhouette Score)
Definimos $k = 3$ clusters para agrupar as RAs em três perfis: **Baixo Risco**, **Médio Risco** e **Alto Risco**.
A validação do modelo foi feita usando a métrica **Silhouette Score** (coeficiente de silhueta), que mede o quão próximo cada ponto está dos pontos de seu próprio cluster em relação aos pontos do cluster mais próximo:

- O score de silhueta médio gerado foi de aproximadamente **0.419**, o que demonstra que o modelo alcançou uma separação clara e consistente entre os grupos de RAs.

### D. Ordenação Dinâmica e Determinística dos Clusters
Por padrão, o K-Means inicializa os centroides de forma aleatória (`random_state=42`), o que significa que o Cluster ID 0 poderia representar "Alto Risco" em uma execução e "Baixo Risco" em outra.
Para tornar a classificação robusta e compatível com as cores do dashboard:
1. Calculamos a soma das médias das taxas de crimes reais nos centroides de cada cluster após o treinamento.
2. Ordenamos os clusters pela soma dessas taxas em ordem crescente.
3. Mapeamos os IDs de forma determinística:
   - **ID 0 (Menor soma de taxas):** Baixo Risco (Verde/Indigo)
   - **ID 1 (Soma intermediária):** Médio Risco (Laranja)
   - **ID 2 (Maior soma de taxas):** Alto Risco (Vermelho)

### E. Tratamento Especial de Exclusão (Unidades Prisionais)
A região "Unidades Prisionais" (Complexo da Papuda) registra crimes violentos graves na série, mas possui população de censo nula ($0$). Calcular a taxa por 100 mil habitantes geraria um erro de divisão por zero ou uma taxa infinita que distorceria completamente os centroides do K-Means.
- **Solução:** Filtramos as "Unidades Prisionais" antes do treinamento do K-Means e atribuímos estaticamente o Cluster ID `-1` ("Não Classificado - Especial") no CSV de saída, preservando a integridade matemática do modelo e a consistência visual no mapa.

---

## 6. Integração Socioeconômica (Microdados da PDAD 2021)

Como complemento analítico de alto valor para a correlação de dados de segurança, integramos indicadores socioeconômicos reais extraídos diretamente dos microdados da **Pesquisa Distrital por Amostra de Domicílios (PDAD 2021)**, realizada pelo Instituto de Pesquisa e Estatística do Distrito Federal (IPEDF).

### A. Otimização de Engenharia de Dados (Bypass de Memória)
Os arquivos originais de microdados da PDAD (`Moradores.csv` com ~52MB e `Domicilios.csv` com ~13MB) possuem centenas de colunas e centenas de milhares de linhas. Carregá-los inteiros na memória de servidores locais ou de navegadores seria altamente ineficiente e propenso a falhas de limite de memória (*out of memory*).
- **Solução:** Aplicamos a técnica de filtragem vertical na carga (`usecols` do Pandas) especificando apenas as colunas:
  - `A01ra` (Código identificador da Região Administrativa).
  - `renda_domiciliar_pc` (Renda Domiciliar Per Capita).
  - `idade` (Idade do morador).
  - `B20_1` (Policiamento militar regular nas proximidades).
  - `B20_2` (Serviço/equipamento particular de segurança).
  - `B20_3` (Serviço/equipamento comunitário de segurança com vizinhos).
- Definimos explicitamente o parâmetro `encoding='latin-1'` para tratar corretamente a decodificação de caracteres especiais comuns em bases de dados governamentais brasileiras.

### B. Agregação e Mapeamento
1. **Indicadores Socioeconômicos Clássicos:**
   * **Renda Domiciliar Per Capita Média:** Agrupamos a base de domicílios por `A01ra`, limpamos os caracteres de decimal (substituindo `,` por `.`) de modo a converter para dados numéricos reais, e calculamos a média aritmética de renda per capita de cada região.
   * **Idade Média:** Agrupamos a base de moradores por `A01ra` e calculamos a idade média da população residente em cada RA.
2. **Indicadores de Percepção e Infraestrutura de Segurança:**
   Para calcular a prevalência de policiamento e segurança em cada RA de forma fidedigna, aplicamos um mapeamento numérico das respostas às perguntas `B20_1`, `B20_2` e `B20_3`:
   * Resposta **"Sim"** (código 1) $\rightarrow$ `100.0`
   * Resposta **"Não"** (código 2) $\rightarrow$ `0.0`
   * Resposta **"Não sabe"** (código 88888) e respostas nulas $\rightarrow$ `NaN` (valores nulos de ponto flutuante do NumPy)
   
   Ao realizar o agrupamento (`groupby`) por RA e extrair a média (`mean`) desses novos valores calculados, o Pandas automaticamente ignora os registros `NaN`. O resultado matemático equivale exatamente à porcentagem de domicílios que responderam de forma afirmativa ("Sim") dentre aqueles que expressaram uma resposta válida, fornecendo os percentuais correspondentes de:
   * **`Policiamento_Militar_Perc`**: Presença percebida de policiamento militar no entorno.
   * **`Seguranca_Privada_Perc`**: Adoção residencial de segurança privada/tecnológica individual.
   * **`Seguranca_Comunitaria_Perc`**: Engajamento em redes de proteção comunitária (ex: vigilância de vizinhança).
3. **Mapeamento Categórico:** Aplicamos o dicionário de códigos oficial da PDAD para traduzir o ID numérico `A01ra` no nome por extenso da RA.
4. **Reconciliação Geográfica:** Normalizamos as strings de nomes para garantir a paridade com a base de crimes (ex: `Plano Piloto` mapeado para `Brasília (Plano Piloto)`).

### C. Resultados e Cruzamento
Utilizamos um `left join` (`pd.merge(..., how='left')`) para anexar os novos indicadores socioeconômicos e de segurança à base unificada de crimes históricos. O arquivo final de saída foi salvo em `base_final_analitica_df.csv` com codificação `utf-8-sig`.
- **Tratamento de Dados Ausentes:** As novas RAs criadas após 2021 (*Arapoanga* e *Água Quente*) e a categoria especial *Unidades Prisionais* não possuem dados no censo de domicílios/moradores de 2021. Essas ocorrências foram mantidas com valores nulos (`NaN`), que são capturados pelo JavaScript do Dashboard e renderizados elegantemente na tela como `"N/A"` para preservar a transparência metodológica.

---

## 7. Fontes de Dados e Referências

Para garantir a reprodutibilidade e a transparência metodológica deste estudo acadêmico, listamos abaixo os canais oficiais de coleta dos dados utilizados no pipeline:

1. **Microdados da PDAD 2021 (IPEDF):**
   * Dados socioeconômicos (renda familiar per capita e idade média por RA) obtidos através das tabelas expandidas da amostra domiciliar.
   * Endereço Eletrônico: [https://ipe.df.gov.br/pdad-2021-3](https://ipe.df.gov.br/pdad-2021-3)

2. **Dados Abertos de Segurança Pública do Distrito Federal:**
   * Séries históricas de criminalidade da SSP/DF, contendo as ocorrências mensais e anuais de homicídios, feminicídios, latrocínios e lesões corporais seguidas de morte.
   * Endereço Eletrônico: [https://www.dados.df.gov.br/dataset?q=SEGURAN%C3%87A&sort=title_string+asc](https://www.dados.df.gov.br/dataset?q=SEGURAN%C3%87A&sort=title_string+asc)


