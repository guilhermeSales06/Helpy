# Helpy - Sistema de Central de Suporte (Helpdesk)

## Integrantes do Grupo
- Guilherme Araújo Sales (guilherme@tech.com)
- Rafael Guimarães Silva (rafael@email.com)
- Vinicius Conceição Rolt (rolt@suporte.com)

## Descrição do Projeto
O Helpy é um sistema de helpdesk desenvolvido em Python com interface gráfica utilizando Tkinter e persistência de dados via SQLite. O objetivo do projeto é gerenciar chamados de suporte técnico, permitindo que clientes registrem problemas, técnicos acompanhem e atualizem o status dos chamados, e administradores gerenciem usuários e designem técnicos para cada chamado.

Funcionalidades principais:
- Cadastro e autenticação de usuários (Administrador, Técnico, Cliente)
- Abertura de chamados por clientes, com definição de prioridade
- Designação de técnicos para chamados pelo administrador
- Atualização do status dos chamados pelos técnicos
- Relatórios de chamados para o administrador
- Interface gráfica intuitiva para cada tipo de usuário

## Requisitos e Configuração

### Requisitos
- Python 3.8 ou superior (recomendado Python 3.10+)
- Sistema operacional: Windows, Linux ou macOS
- As bibliotecas utilizadas (`tkinter` e `sqlite3`) já vêm instaladas por padrão com o Python.
- Não é necessário instalar nenhum banco de dados externo: o SQLite é embutido e o arquivo do banco será criado automaticamente.

### Instalação
1. Certifique-se de ter o Python instalado:
   ```zsh
   python3 --version
   ```
   Caso não tenha, instale o Python pelo site oficial: https://www.python.org/downloads/

2. O Tkinter geralmente já está incluído na instalação padrão do Python. Para garantir que está disponível, execute:
   ```
   python3 -m tkinter
   ```
   Se abrir uma janela de teste, está tudo certo. Caso apareça erro, instale o Tkinter:
   - **Linux (Debian/Ubuntu):**
     ```zsh
     sudo apt-get install python3-tk
     ```
   - **Fedora:**
     ```zsh
     sudo dnf install python3-tkinter
     ```
   - **Windows/macOS:** Tkinter já vem incluso.

3. Não é necessário instalar ou configurar o SQLite. O arquivo do banco (`suporte_central.db`) será criado automaticamente na primeira execução do sistema.

### Estrutura de Arquivos Essenciais
- `app_gui.py`: Interface gráfica principal do sistema
- `classes.py`: Classes de domínio (Usuário, Administrador, Técnico, Cliente, Chamado, CentralDeSuporte)
- `database.py`: Gerenciamento do banco de dados SQLite
- `main.py`: Script de testes e demonstração das funcionalidades
- `suporte_central.db`: Banco de dados SQLite gerado automaticamente na primeira execução

### Como Executar o Software
1. Clone o repositório ou copie os arquivos para uma pasta local.
2. Abra o terminal na pasta do projeto.
3. Execute o arquivo principal da interface gráfica:
   ```zsh
   python3 app_gui.py
   ```
   - O banco de dados será criado automaticamente na primeira execução, sem necessidade de configuração manual.
   - O arquivo `suporte_central.db` aparecerá na pasta do projeto após o primeiro uso.
4. Para rodar os testes/demonstração via terminal, execute:
   ```zsh
   python3 main.py
   ```

### Informações Adicionais
- O sistema já cria um usuário administrador padrão:
   - Email: rolt@suporte.com
   - Senha: 1234
- Usuários de teste também são criados automaticamente na primeira execução.
- O banco de dados é persistido no arquivo `suporte_central.db` na mesma pasta do projeto.
- Não é necessário instalar ou configurar nenhum servidor de banco de dados externo.

## Observações
- Caso deseje resetar o banco de dados, basta apagar o arquivo `suporte_central.db` e executar novamente o sistema.
- O sistema foi desenvolvido para fins acadêmicos, podendo ser expandido para novas funcionalidades conforme necessidade.
- Se encontrar problemas com o Tkinter, verifique se o Python está corretamente instalado e se o Tkinter está disponível conforme instruções acima.
