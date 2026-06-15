import http.server
import socketserver
import webbrowser
import threading
import time
import os
import sys
import subprocess

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIRECTORY = os.path.join(BASE_DIR, "src")
TRATADOS_CSV = os.path.join(DIRECTORY, "base_final_analitica_df.csv")
CLUSTERS_CSV = os.path.join(DIRECTORY, "dados_cvli_df_clusters.csv")

class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Configura o diretório padrão para servir os arquivos do dashboard
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def open_browser():
    # Aguarda 1.5 segundos para garantir que o servidor subiu
    time.sleep(1.5)
    url = f"http://127.0.0.1:{PORT}"
    print(f"\n[INFO] Abrindo o navegador padrão em: {url}")
    webbrowser.open(url)

def get_venv_paths():
    if sys.platform == "win32":
        python_bin = os.path.join(os.getcwd(), ".venv", "Scripts", "python.exe")
        pip_bin = os.path.join(os.getcwd(), ".venv", "Scripts", "pip.exe")
    else:
        python_bin = os.path.join(os.getcwd(), ".venv", "bin", "python")
        pip_bin = os.path.join(os.getcwd(), ".venv", "bin", "pip")
    return python_bin, pip_bin

def check_and_generate_data():
    need_etl = not os.path.exists(TRATADOS_CSV)
    need_ml = not os.path.exists(CLUSTERS_CSV)
    
    if need_etl or need_ml:
        print("============================================================")
        print("[AVISO] Arquivos de dados tratados (.csv) ausentes em /src.")
        print("[INFO] Configurando ambiente virtual Python para geração...")
        print("============================================================")
        
        # Verifica se estamos em um venv ativo
        is_venv = sys.prefix != sys.base_prefix
        
        if is_venv:
            # Já estamos no venv ativo, usa o executável atual
            python_bin = sys.executable
            pip_bin = os.path.join(os.path.dirname(sys.executable), "pip")
            if sys.platform == "win32":
                pip_bin += ".exe"
        else:
            # Não estamos no venv. Cria/Verifica o venv local '.venv'
            python_bin, pip_bin = get_venv_paths()
            venv_exists = os.path.exists(".venv") and os.path.exists(python_bin) and os.path.exists(pip_bin)
            
            if not venv_exists:
                print("[INFO] Criando ambiente virtual (.venv) local...")
                try:
                    subprocess.run([sys.executable, "-m", "venv", ".venv"], check=True)
                    print("[INFO] Ambiente virtual criado com sucesso!")
                except subprocess.CalledProcessError:
                    print("\n[ERRO] Não foi possível criar o ambiente virtual '.venv'.")
                    print("Por favor, verifique se você possui o módulo python3-venv ou python3-full instalado:")
                    print("   No Debian/Ubuntu: sudo apt install python3-venv ou python3-full")
                    print("============================================================")
                    sys.exit(1)
            
        # Verifica dependências no ambiente virtual executando um teste de importação
        deps_ok = True
        for dep in ["pandas", "openpyxl", "numpy", "sklearn"]:
            try:
                # Tenta executar o python do venv para testar a importação
                subprocess.run([python_bin, "-c", f"import {dep}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            except subprocess.CalledProcessError:
                deps_ok = False
                break
        
        if not deps_ok:
            print("[INFO] Dependências ausentes ou incompletas no ambiente virtual.")
            print("[INFO] Instalando bibliotecas em .venv (isso pode levar alguns instantes)...")
            try:
                # Executa o pip correspondente
                subprocess.run([pip_bin, "install", "-r", "requirements.txt"], check=True)
                print("[INFO] Instalação concluída com sucesso!")
            except subprocess.CalledProcessError as e:
                print(f"\n[ERRO] Falha ao instalar dependências no venv: {e}")
                print("Por favor, tente instalar manualmente ativando o venv:")
                print("   source .venv/bin/activate && pip install -r requirements.txt")
                print("============================================================")
                sys.exit(1)
        
        # Roda os scripts usando o python do ambiente virtual
        try:
            if need_etl:
                print("\n[INFO] Executando Pipeline de ETL (scripts/etl.py)...")
                subprocess.run([python_bin, "scripts/etl.py"], check=True)
            if need_ml:
                print("\n[INFO] Executando Pipeline de Machine Learning (scripts/ml_clustering.py)...")
                subprocess.run([python_bin, "scripts/ml_clustering.py"], check=True)
            print("\n[SUCESSO] Todos os arquivos CSV de dados foram gerados com sucesso!")
            print("============================================================")
        except subprocess.CalledProcessError as e:
            print(f"\n[ERRO] Falha ao executar scripts de dados: {e}")
            sys.exit(1)

if __name__ == "__main__":
    # Verifica e gera dados tratados caso necessário
    check_and_generate_data()

    # Inicia a thread para abrir o navegador
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Configura o servidor HTTP local vinculado a 127.0.0.1 (seguro contra conexões externas)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("127.0.0.1", PORT), DashboardHandler) as httpd:
            print(f"============================================================")
            print(f" Servidor de Desenvolvimento Local (AnalyticaDF)")
            print(f" Rodando em: http://127.0.0.1:{PORT}")
            print(f" Diretório base: {DIRECTORY}")
            print(f" Pressione Ctrl+C para encerrar o servidor")
            print(f"============================================================")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Servidor encerrado pelo usuário.")
    except Exception as e:
        print(f"\n[ERRO] Falha ao iniciar o servidor: {e}")
