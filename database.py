import sqlite3
from classes import Usuario, Administrador, Tecnico, Cliente, Chamado

DATABASE_NAME = 'suporte_central.db'

class DatabaseManager:
    def __init__(self, db_name=DATABASE_NAME):
        self.db_name = db_name
        self.conn = None
        self.cursor = None
        self.connect()
        self.create_tables()

    def connect(self):
        self.conn = sqlite3.connect(self.db_name)
        self.cursor = self.conn.cursor()

    def close(self):
        if self.conn:
            self.conn.close()

    def execute_query(self, query, params=()):
        self.cursor.execute(query, params)
        self.conn.commit()
        return self.cursor

    def fetch_one(self, query, params=()):
        self.cursor.execute(query, params)
        return self.cursor.fetchone()

    def fetch_all(self, query, params=()):
        self.cursor.execute(query, params)
        return self.cursor.fetchall()

    def create_tables(self):
        # Tabela de Usuários (Base)
        self.execute_query("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                senha TEXT NOT NULL,
                tipo TEXT NOT NULL -- 'Administrador', 'Tecnico', 'Cliente'
            )
        """)

        self.execute_query("""
            CREATE TABLE IF NOT EXISTS clientes (
                usuario_id INTEGER PRIMARY KEY,
                telefone TEXT,
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
            )
        """)

        self.execute_query("""
            CREATE TABLE IF NOT EXISTS tecnicos (
                usuario_id INTEGER PRIMARY KEY,
                especialidade TEXT,
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
            )
        """)

        self.execute_query("""
            CREATE TABLE IF NOT EXISTS chamados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                descricao TEXT NOT NULL,
                cliente_id INTEGER NOT NULL,
                status TEXT NOT NULL, -- 'Aberto', 'Em andamento', 'Concluído'
                tecnico_id INTEGER,
                prioridade TEXT NOT NULL, -- 'Baixa', 'Normal', 'Alta'
                FOREIGN KEY (cliente_id) REFERENCES usuarios (id) ON DELETE CASCADE,
                FOREIGN KEY (tecnico_id) REFERENCES usuarios (id) ON DELETE SET NULL
            )
        """)
        
        if not self.fetch_one("SELECT id FROM usuarios WHERE email = ?", ('rolt@suporte.com',)):
            self.add_usuario('ROlt', 'rolt@suporte.com', '1234', 'Administrador')


    def add_usuario(self, nome, email, senha, tipo, **kwargs):
        try:
            self.cursor.execute("INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
                                (nome, email, senha, tipo))
            usuario_id = self.cursor.lastrowid
            
            if tipo == 'Cliente':
                self.cursor.execute("INSERT INTO clientes (usuario_id, telefone) VALUES (?, ?)",
                                    (usuario_id, kwargs.get('telefone')))
            elif tipo == 'Tecnico':
                self.cursor.execute("INSERT INTO tecnicos (usuario_id, especialidade) VALUES (?, ?)",
                                    (usuario_id, kwargs.get('especialidade')))
            
            self.conn.commit()
            return usuario_id
        except sqlite3.IntegrityError:
            return None

    def get_usuario_by_email(self, email):
        user_data = self.fetch_one("SELECT id, nome, email, senha, tipo FROM usuarios WHERE email = ?", (email,))
        if not user_data:
            return None
        
        user_id, nome, email, senha, tipo = user_data
        
        if tipo == 'Administrador':
            return Administrador(user_id, nome, email, senha)
        
        elif tipo == 'Tecnico':
            tech_data = self.fetch_one("SELECT especialidade FROM tecnicos WHERE usuario_id = ?", (user_id,))
            especialidade = tech_data[0] if tech_data else None
            return Tecnico(especialidade, nome, email, senha, user_id)
        
        elif tipo == 'Cliente':
            client_data = self.fetch_one("SELECT telefone FROM clientes WHERE usuario_id = ?", (user_id,))
            telefone = client_data[0] if client_data else None
            return Cliente(telefone, nome, email, senha, user_id)
        
        return Usuario(nome, email, senha, user_id) # Caso base, embora os tipos sejam mais específicos

    def get_usuario_by_id(self, user_id):
        user_data = self.fetch_one("SELECT id, nome, email, senha, tipo FROM usuarios WHERE id = ?", (user_id,))
        if not user_data:
            return None
        
        user_id, nome, email, senha, tipo = user_data
        
        if tipo == 'Administrador':
            return Administrador(user_id, nome, email, senha)
        
        elif tipo == 'Tecnico':
            tech_data = self.fetch_one("SELECT especialidade FROM tecnicos WHERE usuario_id = ?", (user_id,))
            especialidade = tech_data[0] if tech_data else None
            return Tecnico(especialidade, nome, email, senha, user_id)
        
        elif tipo == 'Cliente':
            client_data = self.fetch_one("SELECT telefone FROM clientes WHERE usuario_id = ?", (user_id,))
            telefone = client_data[0] if client_data else None
            return Cliente(telefone, nome, email, senha, user_id)
        
        return Usuario(nome, email, senha, user_id)

    def get_all_usuarios(self):
        users = self.fetch_all("SELECT id, email FROM usuarios")
        return [self.get_usuario_by_id(user_id) for user_id, email in users]

    def delete_usuario(self, user_id):
        self.execute_query("DELETE FROM usuarios WHERE id = ?", (user_id,))
        return self.cursor.rowcount > 0

    def add_chamado(self, descricao, cliente_id, prioridade='Normal'):
        self.execute_query("INSERT INTO chamados (descricao, cliente_id, status, prioridade) VALUES (?, ?, ?, ?)",
                           (descricao, cliente_id, 'Aberto', prioridade))
        return self.cursor.lastrowid

    def get_chamado_by_id(self, chamado_id):
        chamado_data = self.fetch_one("SELECT id, descricao, cliente_id, status, tecnico_id, prioridade FROM chamados WHERE id = ?", (chamado_id,))
        if not chamado_data:
            return None
        
        id, descricao, cliente_id, status, tecnico_id, prioridade = chamado_data
        
        cliente = self.get_usuario_by_id(cliente_id)
        tecnico = self.get_usuario_by_id(tecnico_id) if tecnico_id else None
        
        chamado = Chamado(id, descricao, cliente, prioridade)
        chamado.set_status(status) 
        chamado.set_tecnico(tecnico) 
        
        return chamado

    def get_all_chamados(self):
        chamados_data = self.fetch_all("SELECT id FROM chamados")
        return [self.get_chamado_by_id(chamado_id) for chamado_id, in chamados_data]

    def update_chamado_tecnico(self, chamado_id, tecnico_id):
        self.execute_query("UPDATE chamados SET tecnico_id = ? WHERE id = ?", (tecnico_id, chamado_id))
        return self.cursor.rowcount > 0

    def update_chamado_status(self, chamado_id, status):
        self.execute_query("UPDATE chamados SET status = ? WHERE id = ?", (status, chamado_id))
        return self.cursor.rowcount > 0

    def get_chamados_by_cliente(self, cliente_id):
        chamados_data = self.fetch_all("SELECT id FROM chamados WHERE cliente_id = ?", (cliente_id,))
        return [self.get_chamado_by_id(chamado_id) for chamado_id, in chamados_data]

    def get_chamados_by_tecnico(self, tecnico_id):
        chamados_data = self.fetch_all("SELECT id FROM chamados WHERE tecnico_id = ?", (tecnico_id,))
        return [self.get_chamado_by_id(chamado_id) for chamado_id, in chamados_data]

    def get_chamados_by_status(self, status):
        chamados_data = self.fetch_all("SELECT id FROM chamados WHERE status = ?", (status,))
        return [self.get_chamado_by_id(chamado_id) for chamado_id, in chamados_data]

    def get_next_chamado_id(self):
        return None 

    def get_all_tecnicos(self):
        users = self.fetch_all("SELECT u.id, u.email FROM usuarios u JOIN tecnicos t ON u.id = t.usuario_id")
        return [self.get_usuario_by_id(user_id) for user_id, email in users]

    def get_all_clientes(self):
        users = self.fetch_all("SELECT u.id, u.email FROM usuarios u JOIN clientes c ON u.id = c.usuario_id")
        return [self.get_usuario_by_id(user_id) for user_id, email in users]

    def get_all_administradores(self):
        users = self.fetch_all("SELECT id, email FROM usuarios WHERE tipo = 'Administrador'")
        return [self.get_usuario_by_id(user_id) for user_id, email in users]


