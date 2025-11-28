class Usuario:
    def __init__(self, nome, email, senha, id=None):
        self.__id = id
        self.__nome = nome
        self.__email = email
        self.__senha = senha


    def get_id(self):
        return self.__id

    def get_nome(self):
        return self.__nome


    def get_email(self):
        return self.__email

    def get_senha(self):
        return self.__senha

    def autenticar(self, email, senha):
        return self.__email == email and self.__senha == senha

    def __str__(self):
        return f'ID: {self.__id} | Nome: {self.__nome}\nEmail: {self.__email}'

class Administrador(Usuario):
    def __init__(self, id, nome, email, senha):
        super().__init__(nome, email, senha, id)

    def cadastrar_cliente(self, db_manager, nome, email, senha, telefone):
        user_id = db_manager.add_usuario(nome, email, senha, 'Cliente', telefone=telefone)
        if user_id:
            return db_manager.get_usuario_by_id(user_id)
        return None

    def cadastrar_tecnico(self, db_manager, nome, email, senha, especialidade):
        user_id = db_manager.add_usuario(nome, email, senha, 'Tecnico', especialidade=especialidade)
        if user_id:
            return db_manager.get_usuario_by_id(user_id)
        return None


    def excluir_usuario(self, db_manager, usuario):
        return db_manager.delete_usuario(usuario.get_id())


    def designar_tecnico(self, db_manager, chamado, tecnico):
        if db_manager.update_chamado_tecnico(chamado.get_id(), tecnico.get_id()):
            chamado.atribuir_tecnico(tecnico)
            return True
        return False


    def gerar_relatorio(self, chamados):
        relatorio = f'Relatório de Chamados - Total: {len(chamados)}\n'
        for chamado in chamados:
            relatorio += str(chamado) + '\n'
        return relatorio


class Tecnico(Usuario):
    def __init__(self, especialidade, nome, email, senha, id=None):
        super().__init__(nome, email, senha, id)
        self.__especialidade = especialidade

    def get_especialidade(self):
        return self.__especialidade

    def alterar_status(self, db_manager, chamado, status):
        if db_manager.update_chamado_status(chamado.get_id(), status):
            chamado.atualizar_status(status)
            return True
        return False

    def enviar_msg(self, cliente, mensagem):
        return f'Mensagem para {cliente.get_nome()}: {mensagem}'


class Cliente(Usuario):
    def __init__(self, telefone, nome, email, senha, id=None):
        super().__init__(nome, email, senha, id)
        self.__telefone = telefone

    def get_telefone(self):
        return self.__telefone

    def abrir_chamado(self, db_manager, descricao, prioridade='Normal'):
        chamado_id = db_manager.add_chamado(descricao, self.get_id(), prioridade)
        if chamado_id:
            return db_manager.get_chamado_by_id(chamado_id)
        return None

    def listar_chamados(self, db_manager):
        return db_manager.get_chamados_by_cliente(self.get_id())

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

    def set_status(self, status):
        self.__status = status

    def set_tecnico(self, tecnico):
        self.__tecnico = tecnico

    def __str__(self):
        tecnico_nome = self.__tecnico.get_nome() if self.__tecnico else 'Nenhum'
        return f'Chamado ID: {self.__id}\nCliente: {self.__cliente.get_nome()}\nDescrição: {self.__descricao}\nStatus: {self.__status}\nPrioridade: {self.__prioridade}\nTécnico: {tecnico_nome}'

class CentralDeSuporte:
    def __init__(self, db_manager):
        self.db_manager = db_manager

    def adicionar_usuario(self, usuario):
        if usuario.get_id() is not None:
            return True
        return True

    def remover_usuario(self, usuario):
        return True

    def adicionar_chamado(self, chamado):
        return True

    def gerar_id_chamado(self):
        return None

    def listar_usuarios(self):
        return self.db_manager.get_all_usuarios()

    def listar_chamados(self):
        return self.db_manager.get_all_chamados()

    def listar_chamados_concluidos(self):
        return self.db_manager.get_chamados_by_status('Concluído')

    def listar_chamados_abertos(self):
        return self.db_manager.get_chamados_by_status('Aberto')
