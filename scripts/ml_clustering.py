import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import os

def run_clustering():
    print("=== Iniciando Processamento de Machine Learning (K-Means) ===")
    
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 1. Carrega os dados tratados
    csv_path = os.path.join(BASE_DIR, "src", "base_final_analitica_df.csv")
    if not os.path.exists(csv_path):
        print(f"[ERRO] Base tratada não encontrada em: {csv_path}")
        return
        
    df = pd.read_csv(csv_path)
    
    # 2. Filtra RAs válidas (remove Unidades Prisionais pois tem população 0 e distorceria as taxas)
    df_valid = df[df['Regiao_Administrativa'] != 'Unidades Prisionais'].copy()
    
    # 3. Calcula a População por RA (valor estático de 2024)
    ra_pop = df_valid.groupby('Regiao_Administrativa')['Populacao'].first()
    
    # 4. Agrupa crimes por RA e Tipo de Crime para somar as vítimas na década (2015-2024)
    ra_crimes = df_valid.groupby(['Regiao_Administrativa', 'Tipo_Crime'])['Qtd_Vitimas'].sum().unstack(fill_value=0)
    
    # 5. Junta os dados de crimes com a população
    df_features = ra_crimes.join(ra_pop)
    
    # 6. Calcula a Taxa Anualizada por 100k hab. para cada um dos 4 tipos de crimes (10 anos na série)
    crime_columns = ['Homicídio', 'Latrocínio', 'Lesão Seguida de Morte', 'Feminicídio']
    for col in crime_columns:
        # Taxa = (Vítimas Totais / 10 anos) / População * 100k
        df_features[f'{col}_Taxa'] = (df_features[col] / 10) / df_features['Populacao'] * 100000
        # Substitui possíveis divisões por zero ou nulos
        df_features[f'{col}_Taxa'] = df_features[f'{col}_Taxa'].fillna(0)
        
    # Colunas de características (features) para o modelo de ML
    features_cols = [f'{col}_Taxa' for col in crime_columns]
    X = df_features[features_cols].values
    
    # 7. Padronização das características (StandardScaler)
    # O K-Means usa distâncias euclidianas, logo atributos com escalas maiores dominariam o modelo.
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # 8. Executa o Algoritmo K-Means (n_clusters = 3 para Baixo, Médio e Alto Risco)
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    cluster_labels = kmeans.fit(X_scaled)
    
    # 9. Ordenação determinística dos clusters pela soma das taxas médias do centroide
    # Isso garante que a classificação 0 = Baixo, 1 = Médio, 2 = Alto risco seja consistente entre execuções
    centers = kmeans.cluster_centers_
    # Desfaz a escala apenas para ver a soma das taxas reais do centroide
    centers_inverse = scaler.inverse_transform(centers)
    center_sums = centers_inverse.sum(axis=1)
    
    # Mapeamento dinâmico
    sorted_cluster_indices = np.argsort(center_sums) # Menor soma para maior
    label_mapping = {sorted_cluster_indices[i]: i for i in range(3)}
    
    df_features['Cluster_Id'] = [label_mapping[label] for label in kmeans.labels_]
    
    # Mapeia ID numérico para rótulo legível
    cluster_names = {
        0: "Baixo Risco",
        1: "Médio Risco",
        2: "Alto Risco"
    }
    df_features['Cluster_Nome'] = df_features['Cluster_Id'].map(cluster_names)
    
    # 10. Validação do Modelo (Silhouette Score)
    sil_score = silhouette_score(X_scaled, kmeans.labels_)
    print(f"[VALIDAÇÃO] Silhouette Score do K-Means: {sil_score:.3f}")
    
    # 11. Monta o DataFrame de saída
    df_output = df_features[['Cluster_Id', 'Cluster_Nome']].reset_index()
    
    # Adiciona a RA especial "Unidades Prisionais" de forma estática com perfil separado
    prisionais_row = pd.DataFrame([{
        'Regiao_Administrativa': 'Unidades Prisionais',
        'Cluster_Id': -1,
        'Cluster_Nome': 'Não Classificado (Especial)'
    }])
    df_output = pd.concat([df_output, prisionais_row], ignore_index=True)
    
    # Salva os resultados do agrupamento
    output_path = os.path.join(BASE_DIR, "src", "dados_cvli_df_clusters.csv")
    df_output.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    print(f"[SUCESSO] Agrupamento concluído! Arquivo gerado em: {output_path}")
    print(df_output.groupby('Cluster_Nome')['Regiao_Administrativa'].count())
    print("============================================================\n")

if __name__ == "__main__":
    run_clustering()
