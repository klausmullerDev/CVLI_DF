# Dashboard Analítico CVLI Distrito Federal (2015-2024)

Este projeto foi desenvolvido para analisar a evolução temporal e a distribuição regional dos Crimes Violentos Letais Intencionais (CVLI) no Distrito Federal de 2015 a 2024. O sistema integra um pipeline de **Engenharia de Dados (ETL)**, um modelo de **Machine Learning (K-Means Clustering)** para segmentação inteligente de RAs por criticidade, e um **Dashboard Web** responsivo e interativo (HTML/CSS/JS com Leaflet.js e Chart.js).

O repositório foi enriquecido com os microdados socioeconômicos oficiais da **Pesquisa Distrital por Amostra de Domicílios (PDAD 2021)** para correlacionar indicadores demográficos (Renda Per Capita e Idade Média) com os índices de violência por RA.

---

## 📂 Estrutura Organizacional do Projeto

O projeto está estruturado de forma limpa e modular:

```text
CVLI_DF/
├── sources/                     # Arquivos brutos de origem (Excel e CSV)
│   ├── tabelasseriehistorica-homicidio.xlsx
│   ├── tabelasseriehistorica-latrocinio.xlsx
│   ├── tabelasseriehistorica-lcsm.xlsx
│   ├── tabelasseriehistorica-feminicidio.xlsx
│   ├── PDAD_2021-Domicilios.csv # Microdados de Domicílios (IPEDF)
│   └── PDAD_2021-Moradores.csv  # Microdados de Moradores (IPEDF)
│
├── scripts/                     # Inteligência de dados
│   ├── etl.py                   # Pipeline de ETL (Limpeza, Unpivot, Joins com População e PDAD)
│   └── ml_clustering.py         # Modelo de K-Means para agrupamento de RAs por risco
│
├── src/                         # Código-fonte da aplicação web
│   ├── index.html               # Estrutura HTML do painel e aba do mapa
│   ├── style.css                # Estilização visual (Tema Escuro / Glassmorphism)
│   ├── app.js                   # Lógica JS reativa (PapaParse, Leaflet e Chart.js)
│   ├── base_final_analitica_df.csv # Base enriquecida final: Crimes + População + Socioeconômico
│   ├── dados_cvli_df_clusters.csv # Classificações de risco geradas pelo K-Means
│   └── dados_cvli_df_tratados.csv # Cópia para retrocompatibilidade
│
├── run.py                       # Launcher automatizado com auto-bootstrapping
├── RELATORIO_METODOLOGIA.md     # Relatório metodológico científico para defesa acadêmica
└── requirements.txt             # Dependências Python (pandas, scikit-learn, etc.)
```

---

## 📊 A Nova Base Analítica (`base_final_analitica_df.csv`)

O arquivo final analítico gerado unifica três fontes de dados distintas:
1. **Dados Criminológicos (SSP/DF):** Quantidade anual de vítimas de Homicídio, Latrocínio, Lesão Corporal Seguida de Morte e Feminicídio por RA (2015-2024).
2. **Dados Demográficos (PDAD/IBGE):** População total de 2024 de cada Região Administrativa para cálculo de taxas.
3. **Dados Socioeconômicos (PDAD 2021):**
   * **Renda_Per_Capita:** Renda domiciliar média por pessoa da RA obtida a partir da amostra expandida de domicílios da PDAD 2021.
   * **Idade_Media:** Idade média da população residente na RA obtida a partir da amostra expandida de moradores.

*Nota: Regiões criadas após a pesquisa (Arapoanga, Água Quente) e áreas de contagem especial (Unidades Prisionais) exibem esses dois últimos indicadores como `NaN` na tabela (mostrados no dashboard como `"N/A"`).*

---

## 🚀 Como Iniciar o Dashboard (Execução Rápida)

Você **não precisa instalar nenhuma biblioteca adicional do Python** se desejar apenas visualizar o dashboard! Ele funciona imediatamente usando os dados analíticos pré-processados que estão na pasta `/src`.

1. **Iniciar a Aplicação:**
   Execute o comando abaixo no terminal da raiz do projeto:
   ```bash
   python3 run.py
   ```
   *O inicializador verificará os arquivos de dados locais, iniciará um servidor web seguro em `127.0.0.1:8000` e abrirá a página no seu navegador padrão automaticamente!*

2. **Acesso Manual (Se necessário):**
   Navegue para:
   👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## ⚙️ Reprocessar Dados e Machine Learning (Opcional)

Caso queira atualizar as planilhas do diretório `/sources` e rodar a engenharia de dados/IA novamente:

1. **Criar e Ativar Ambiente Virtual:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Instalar Dependências:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Rodar de Forma Unificada:**
   Se você deletar os arquivos `.csv` de `/src`, basta executar:
   ```bash
   python3 run.py
   ```
   *O script `run.py` detectará a ausência dos dados e executará os pipelines `scripts/etl.py` e `scripts/ml_clustering.py` automaticamente antes de subir o servidor!*
