class Usuario:
    def __init__(self, nome, email, senha):
        self.__nome = nome
        self.__email = email
        self.__senha = senha


    def get_nome(self):
        return self.__nome
    
    
    def get_email(self):
        return self.__email
    
    def get_senha(self):
        return self.__senha
    
    def autenticar(self, email, senha):
        return self.__email == email and self.__senha == senha
    
    def __str__(self):
        return f'Nome: {self.__nome}\nEmail: {self.__email}'

class Administrador(Usuario):
    def __init__(self, id, nome, email, senha):
        super().__init__(nome, email, senha)
        self.__id = id

    def get_id(self):
        return self.__id
    
    def cadastrar_cliente(self, nome, email, senha, telefone):
        return Cliente(telefone, nome, email, senha)
    
    
    def cadastrar_tecnico(self, nome, email, senha, especialidade):
        return Tecnico(especialidade, nome, email, senha)
    
        
    def excluir_usuario(self, central, usuario):
        central.remover_usuario(usuario)
        return True
    
    
    def designar_tecnico(self, chamado, tecnico):
        chamado.atribuir_tecnico(tecnico)
        return True
    
    
    def gerar_relatorio(self, chamados):
        relatorio = f'Relatório de Chamados - Total: {len(chamados)}\n'
        for chamado in chamados:
            relatorio += str(chamado) + '\n'
        return relatorio


class Tecnico(Usuario):
    def __init__(self, especialidade, nome, email, senha):
        super().__init__(nome, email, senha)
        self.__especialidade = especialidade

    def get_especialidade(self):
        return self.__especialidade
    
    def alterar_status(self, chamado, status):
        chamado.atualizar_status(status)
        return True
    
    def enviar_msg(self, cliente, mensagem):
        return f'Mensagem para {cliente.get_nome()}: {mensagem}'
    

class Cliente(Usuario):
    def __init__(self, telefone, nome, email, senha):
        super().__init__(nome, email, senha)
        self.__telefone = telefone
        self.__chamados_abertos = []

    def get_telefone(self):
        return self.__telefone

    def abrir_chamado(self, central, descricao, prioridade='Normal'):
        chamado = Chamado(central.gerar_id_chamado(), descricao, self, prioridade)
        self.__chamados_abertos.append(chamado)
        central.adicionar_chamado(chamado)
        return chamado
    
    def listar_chamados(self):
        return self.__chamados_abertos

class Chamado:
    def __init__(self, id, descricao, cliente, prioridade='Normal'):
        self.__id = id
        self.__descricao = descricao
        self.__cliente = cliente
        self.__status = 'Aberto'
        self.__tecnico = None
        self.__prioridade = prioridade

    def get_id(self):
        return self.__id
    
    def get_descricao(self):
        return self.__descricao
    
    def get_status(self):
        return self.__status
    
    def get_tecnico(self):
        return self.__tecnico
    
    def get_cliente(self):
        return self.__cliente
    
    def get_prioridade(self):
        return self.__prioridade
    
    def atribuir_tecnico(self, tecnico):
        self.__tecnico = tecnico
        return True

    def atualizar_status(self, status):
        self.__status = status
        return True
    
    def __str__(self):
        tecnico_nome = self.__tecnico.get_nome() if self.__tecnico else 'Nenhum'
        return f'Chamado ID: {self.__id}\nCliente: {self.__cliente.get_nome()}\nDescrição: {self.__descricao}\nStatus: {self.__status}\nPrioridade: {self.__prioridade}\nTécnico: {tecnico_nome}'

class CentralDeSuporte:
    def __init__(self):
        self.__usuarios = []
        self.__chamados = []
        self.__proximo_id = 1

    def adicionar_usuario(self, usuario):
        self.__usuarios.append(usuario)
        return True

    def remover_usuario(self, usuario):
        if usuario in self.__usuarios:
            self.__usuarios.remove(usuario)
            return True
        return False

    def adicionar_chamado(self, chamado):
        self.__chamados.append(chamado)
        return True

    def gerar_id_chamado(self):
        id_atual = self.__proximo_id
        self.__proximo_id += 1
        return id_atual

    def listar_usuarios(self):
        return self.__usuarios
    
    def listar_chamados(self):
        return self.__chamados
    
    def listar_chamados_concluidos(self):
        chamados_concluidos = []
        for chamado in self.__chamados:
            if chamado.get_status() == 'Concluído':
                chamados_concluidos.append(chamado)
        return chamados_concluidos
    
    def listar_chamados_abertos(self):
        chamados_abertos = []
        for chamado in self.__chamados:
            if chamado.get_status() == 'Aberto':
                chamados_abertos.append(chamado)
        return chamados_abertos