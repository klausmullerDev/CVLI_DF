import pandas as pd
import numpy as np
import os

def tratar_planilha_cvli(caminho_arquivo, nome_crime, pular_linhas, nome_aba=0):
    print(f"Processando: {os.path.basename(caminho_arquivo)} ({nome_crime})")
    
    # 1. Carrega o arquivo pulando o cabeçalho
    df = pd.read_excel(caminho_arquivo, sheet_name=nome_aba, skiprows=pular_linhas)
    
    # 2. Limpa colunas completamente vazias
    df = df.dropna(how='all', axis=1)
    
    # 3. Renomeia a primeira coluna para Regiao_Administrativa
    df.columns = ['Regiao_Administrativa'] + list(df.columns[1:])
    
    # 4. Mantém apenas a coluna da RA e as colunas correspondentes aos anos de 2015 a 2024
    anos_validos = [str(ano) for ano in range(2015, 2025)]
    
    def is_year_col(col):
        col_str = str(col).strip()
        # Se for float (ex: 2020.0), pega a parte inteira
        base = col_str.split('.')[0]
        return base in anos_validos
        
    colunas_validas = ['Regiao_Administrativa'] + [col for col in df.columns[1:] if is_year_col(col)]
    df = df[colunas_validas]
    
    # 5. Remove linhas de totais, nulas ou outras anomalias textuais
    df = df.dropna(subset=['Regiao_Administrativa'])
    df['Regiao_Administrativa'] = df['Regiao_Administrativa'].astype(str).str.strip()
    df = df[df['Regiao_Administrativa'] != '']
    
    # Filtrar agregados e anomalias textuais comuns
    pattern_exclude = 'Distrito Federal|Total|Tabela|Gráfico|valor não divisivel por zero'
    df = df[~df['Regiao_Administrativa'].str.contains(pattern_exclude, case=False, na=False)]
    
    # 6. Substitui hífens (-) e asteriscos (*) por zero e garante numérico
    df = df.replace('-', 0).replace('*', 0)
    for col in df.columns[1:]:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
    
    # 7. O UNPIVOT: Transforma colunas de anos em linhas
    df_melted = df.melt(id_vars=['Regiao_Administrativa'], var_name='Ano', value_name='Qtd_Vitimas')
    
    # Limpa as colunas resultantes do melt
    df_melted['Ano'] = df_melted['Ano'].apply(lambda x: int(float(str(x).strip())))
    df_melted['Qtd_Vitimas'] = df_melted['Qtd_Vitimas'].astype(int)
    
    # Adiciona o tipo de crime
    df_melted['Tipo_Crime'] = nome_crime
    
    return df_melted

# Diretório de fontes
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sources_dir = os.path.join(BASE_DIR, "sources")

# Processamento individual dos crimes
df_homicidio = tratar_planilha_cvli(
    os.path.join(sources_dir, "tabelasseriehistorica-homicidio.xlsx"), 
    "Homicídio", 
    pular_linhas=4
)
df_latrocinio = tratar_planilha_cvli(
    os.path.join(sources_dir, "tabelasseriehistorica-latrocinio.xlsx"), 
    "Latrocínio", 
    pular_linhas=5
)
df_lcsm = tratar_planilha_cvli(
    os.path.join(sources_dir, "tabelasseriehistorica-lcsm.xlsx"), 
    "Lesão Seguida de Morte", 
    pular_linhas=2
)
df_feminicidio = tratar_planilha_cvli(
    os.path.join(sources_dir, "tabelasseriehistorica-feminicidio.xlsx"), 
    "Feminicídio", 
    pular_linhas=2, 
    nome_aba="Feminicidio (atualizado)"
)

# Concatenação das bases de crimes
base_crimes = pd.concat([df_homicidio, df_latrocinio, df_lcsm, df_feminicidio], ignore_index=True)

# ----------------- TRATAMENTO DOS DADOS DE POPULAÇÃO -----------------
print("Processando dados de População...")
path_f = os.path.join(sources_dir, "tabelasseriehistorica-feminicidio.xlsx")
df_pop = pd.read_excel(path_f, sheet_name='População')

# Renomeia colunas para facilitar a manipulação
df_pop.columns = ['col0', 'RA', 'Populacao']
df_pop = df_pop.dropna(subset=['RA', 'Populacao'])
df_pop = df_pop.drop(columns=['col0'])
df_pop['RA'] = df_pop['RA'].astype(str).str.strip()

# Remove cabeçalho e rodapé desnecessários
df_pop = df_pop[df_pop['RA'] != 'RA']
df_pop = df_pop[~df_pop['RA'].str.contains('Total|População', case=False, na=False)]

# Mapeia nomes das RAs para correspondência perfeita com a base de crimes
pop_mapping = {
    'Plano Piloto': 'Brasília (Plano Piloto)',
    'N. Bandeirante': 'Núcleo Bandeirante',
    'Sol Nascente e Pôr do Sol': 'Sol Nascente/Pôr do Sol',
    'Sudoeste e Octogonal': 'Sudoeste/Octogonal'
}
df_pop['RA'] = df_pop['RA'].replace(pop_mapping)
df_pop['Populacao'] = pd.to_numeric(df_pop['Populacao'], errors='coerce').fillna(0).round().astype(int)

# ----------------- CRIAÇÃO DO GRID DE INTEGRIDADE -----------------
print("Construindo grid completo de RAs x Anos x Crimes...")
# Lista unificada de todas as RAs
todas_ras = sorted(list(set(base_crimes['Regiao_Administrativa'].unique()).union(set(df_pop['RA'].unique()))))
anos = list(range(2015, 2025))
crimes = ["Homicídio", "Latrocínio", "Lesão Seguida de Morte", "Feminicídio"]

# Cria o template com todas as combinações
grid = pd.MultiIndex.from_product(
    [todas_ras, anos, crimes], 
    names=['Regiao_Administrativa', 'Ano', 'Tipo_Crime']
).to_frame().reset_index(drop=True)

# Junta os dados reais de crimes no grid
base_final = pd.merge(
    grid, 
    base_crimes, 
    on=['Regiao_Administrativa', 'Ano', 'Tipo_Crime'], 
    how='left'
)
base_final['Qtd_Vitimas'] = base_final['Qtd_Vitimas'].fillna(0).astype(int)

# Junta os dados de população
base_final = pd.merge(
    base_final, 
    df_pop, 
    left_on='Regiao_Administrativa', 
    right_on='RA', 
    how='left'
)
base_final = base_final.drop(columns=['RA'])
base_final['Populacao'] = base_final['Populacao'].fillna(0).astype(int)

# ----------------- PROCESSAMENTO SOCIOECONÔMICO (PDAD 2021) -----------------
print("Processando dados socioeconômicos da PDAD 2021...")
dom_path = os.path.join(sources_dir, "PDAD_2021-Domicilios.csv")
mor_path = os.path.join(sources_dir, "PDAD_2021-Moradores.csv")

# 1. Carregar Mapeamento de RAs dinamicamente do dicionário de variáveis XLS
print("Extraindo dicionário de RAs do arquivo de variáveis...")
xls_path = os.path.join(sources_dir, "dicionario_de_variaveis_pdad_2021.xls")
df_anexo = pd.read_excel(xls_path, sheet_name="anexo_1")

# Limpa e filtra o anexo
df_anexo = df_anexo.dropna(subset=['Valor', 'Descrição do valor'])
df_anexo['Valor'] = df_anexo['Valor'].astype(int)
df_anexo['Descrição do valor'] = df_anexo['Descrição do valor'].astype(str).str.strip()

# Converte em dicionário ra_mapping_pdad
ra_mapping_pdad = dict(zip(df_anexo['Valor'], df_anexo['Descrição do valor']))

# 2. Processar Domicílios (Renda Domiciliar Per Capita e Indicadores de Segurança)
print("Carregando Domicílios (Microdados)...")
cols_dom = ["A01ra", "renda_domiciliar_pc", "B20_1", "B20_2", "B20_3"]
try:
    df_dom = pd.read_csv(dom_path, sep=";", usecols=cols_dom, encoding='latin-1')
except Exception as e:
    print(f"[AVISO] Falha ao ler Domicílios com latin-1, tentando utf-8: {e}")
    df_dom = pd.read_csv(dom_path, sep=";", usecols=cols_dom, encoding='utf-8')

# Limpar renda_domiciliar_pc
df_dom['renda_domiciliar_pc'] = df_dom['renda_domiciliar_pc'].astype(str).str.replace(',', '.')
df_dom['renda_domiciliar_pc'] = pd.to_numeric(df_dom['renda_domiciliar_pc'], errors='coerce')

# Processar as variáveis de segurança (1 = Sim, 2 = Não, outros como 88888 mapeados para NaN)
df_dom['B20_1_val'] = df_dom['B20_1'].map({1: 100.0, 2: 0.0})
df_dom['B20_2_val'] = df_dom['B20_2'].map({1: 100.0, 2: 0.0})
df_dom['B20_3_val'] = df_dom['B20_3'].map({1: 100.0, 2: 0.0})

# Agrupar por RA e calcular médias
print("Agrupando domicílios por RA...")
df_dom_grouped = df_dom.groupby('A01ra').agg({
    'renda_domiciliar_pc': 'mean',
    'B20_1_val': 'mean',
    'B20_2_val': 'mean',
    'B20_3_val': 'mean'
}).reset_index()

df_dom_grouped.rename(columns={
    'renda_domiciliar_pc': 'Renda_Per_Capita',
    'B20_1_val': 'Policiamento_Militar_Perc',
    'B20_2_val': 'Seguranca_Privada_Perc',
    'B20_3_val': 'Seguranca_Comunitaria_Perc'
}, inplace=True)

# 3. Processar Moradores (Idade Média)
print("Carregando Moradores (Microdados)...")
try:
    df_mor = pd.read_csv(mor_path, sep=";", usecols=["A01ra", "idade"], encoding='latin-1')
except Exception as e:
    print(f"[AVISO] Falha ao ler Moradores com latin-1, tentando utf-8: {e}")
    df_mor = pd.read_csv(mor_path, sep=";", usecols=["A01ra", "idade"], encoding='utf-8')

df_mor['idade'] = pd.to_numeric(df_mor['idade'], errors='coerce')

# Agrupar por RA e calcular média
print("Agrupando idade por RA...")
df_mor_grouped = df_mor.groupby('A01ra')['idade'].mean().reset_index()
df_mor_grouped.rename(columns={'idade': 'Idade_Media'}, inplace=True)

# 4. Consolidação Socioeconômica
df_socio = pd.merge(df_dom_grouped, df_mor_grouped, on='A01ra', how='outer')
df_socio = df_socio[df_socio['A01ra'].isin(ra_mapping_pdad.keys())]
df_socio['Regiao_Administrativa'] = df_socio['A01ra'].map(ra_mapping_pdad)

# Reconciliação dos nomes de RAs para corresponder à base de crimes do projeto
ra_name_normalization = {
    'Plano Piloto': 'Brasília (Plano Piloto)',
    'SCIA': 'SCIA/Estrutural',
    'Sol Nascente / Pôr do Sol': 'Sol Nascente/Pôr do Sol',
    'Sudoeste e Octogonal': 'Sudoeste/Octogonal',
    'Recanto Das Emas': 'Recanto das Emas'
}
df_socio['Regiao_Administrativa'] = df_socio['Regiao_Administrativa'].replace(ra_name_normalization)

# 5. Cruzamento Final (Left Join com base de crimes)
print("Mesclando crimes com dados socioeconômicos...")
base_final['Regiao_Administrativa'] = base_final['Regiao_Administrativa'].str.strip()
df_final = pd.merge(
    base_final, 
    df_socio[['Regiao_Administrativa', 'Renda_Per_Capita', 'Idade_Media', 'Policiamento_Militar_Perc', 'Seguranca_Privada_Perc', 'Seguranca_Comunitaria_Perc']], 
    on='Regiao_Administrativa', 
    how='left'
)

# Cria a pasta src se não existir
os.makedirs(os.path.join(BASE_DIR, "src"), exist_ok=True)

# Salva a base final consolidada (principal e fallback)
output_path = os.path.join(BASE_DIR, "src", "base_final_analitica_df.csv")
output_path_fallback = os.path.join(BASE_DIR, "src", "dados_cvli_df_tratados.csv")

df_final.to_csv(output_path, index=False, encoding='utf-8-sig')
df_final.to_csv(output_path_fallback, index=False, encoding='utf-8-sig')

print(f"ETL concluído com sucesso! Base final salva em: {output_path}")
print(f"Linhas geradas: {len(df_final)}")
