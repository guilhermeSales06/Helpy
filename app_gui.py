import tkinter as tk
from tkinter import messagebox
import tkinter.ttk as ttk
from classes import *

class AppSuporte(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Sistema de Central de Suporte")
        self.geometry("800x600")
        
        self.central = CentralDeSuporte()
        self.admin = Administrador(1, "ROlt", "rolt@suporte.com", "1234")
        self.central.adicionar_usuario(self.admin)
        
        self.cliente1 = self.admin.cadastrar_cliente("rafael", "rafael@email.com", "abcd", "11999999999")
        self.tecnico1 = self.admin.cadastrar_tecnico("guilherme", "guilherme@tech.com", "4321", "Hardware")
        self.central.adicionar_usuario(self.cliente1)
        self.central.adicionar_usuario(self.tecnico1)
        self.cliente1.abrir_chamado(self.central, "Computador não liga", "Alta")
        
        self.usuario_logado = None
        
        self.container = tk.Frame(self)
        self.container.pack(fill="both", expand=True)
        
        self.frames = {}
        
        for F in (TelaLogin, TelaAdmin, TelaCliente, TelaTecnico):
            page_name = F.__name__
            frame = F(parent=self.container, controller=self)
            self.frames[page_name] = frame
            frame.grid(row=0, column=0, sticky="nsew")
            
        self.show_frame("TelaLogin")

    def show_frame(self, page_name):
        frame = self.frames[page_name]
        if page_name == "TelaAdmin":
            frame.update_chamados_list()
        elif page_name == "TelaTecnico":
            frame.update_chamados_list()
        elif page_name == "TelaCliente":
            frame.update_meus_chamados_list()
            
        frame.tkraise()
        
    def fazer_login(self, email, senha):
        for usuario in self.central.listar_usuarios():
            if usuario.autenticar(email, senha):
                self.usuario_logado = usuario
                if isinstance(usuario, Administrador):
                    self.show_frame("TelaAdmin")
                elif isinstance(usuario, Cliente):
                    self.show_frame("TelaCliente")
                elif isinstance(usuario, Tecnico):
                    self.show_frame("TelaTecnico")
                return True
        messagebox.showerror("Erro de Login", "Email ou senha inválidos.")
        return False

    def fazer_logout(self):
        self.usuario_logado = None
        self.show_frame("TelaLogin")

# --- Telas ---

class TelaLogin(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        
        tk.Label(self, text="Login", font=("Arial", 24)).pack(pady=10)
        
        tk.Label(self, text="Email:").pack(pady=5)
        self.email_entry = tk.Entry(self, width=30)
        self.email_entry.pack(pady=5)
        
        tk.Label(self, text="Senha:").pack(pady=5)
        self.senha_entry = tk.Entry(self, width=30, show="*")
        self.senha_entry.pack(pady=5)
        
        tk.Button(self, text="Entrar", command=self.login).pack(pady=10)
        
        tk.Label(self, text="Dados de Teste:").pack(pady=10)
        tk.Label(self, text="Admin: rolt@suporte.com / 1234").pack()
        tk.Label(self, text="Cliente: rafael@email.com / abcd").pack()
        tk.Label(self, text="Técnico: guilherme@tech.com / 4321").pack()

    def login(self):
        email = self.email_entry.get()
        senha = self.senha_entry.get()
        self.controller.fazer_login(email, senha)
        
class TelaAdmin(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        
        tk.Label(self, text="Área do Administrador", font=("Arial", 24)).pack(pady=10)
        
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill="both", padx=10, pady=10)
        
        self.aba_chamados = tk.Frame(self.notebook)
        self.notebook.add(self.aba_chamados, text="Gerenciar Chamados")
        self.setup_aba_chamados()
        
        self.aba_usuarios = tk.Frame(self.notebook)
        self.notebook.add(self.aba_usuarios, text="Gerenciar Usuários")
        self.setup_aba_usuarios()
        
        tk.Button(self, text="Sair", command=controller.fazer_logout).pack(pady=10)

    def setup_aba_chamados(self):
        tk.Label(self.aba_chamados, text="Chamados Abertos", font=("Arial", 16)).pack(pady=5)
        
        self.chamados_listbox = tk.Listbox(self.aba_chamados, width=100, height=15)
        self.chamados_listbox.pack(padx=10, pady=5)
        self.chamados_listbox.bind('<<ListboxSelect>>', self.selecionar_chamado)
        
        designar_frame = tk.Frame(self.aba_chamados)
        designar_frame.pack(pady=10)
        
        tk.Label(designar_frame, text="Designar Técnico:").pack(side="left", padx=5)
        
        self.tecnicos_var = tk.StringVar(designar_frame)
        self.tecnicos_dropdown = ttk.Combobox(designar_frame, textvariable=self.tecnicos_var, state="readonly")
        self.tecnicos_dropdown.pack(side="left", padx=5)
        
        tk.Button(designar_frame, text="Designar", command=self.designar_tecnico).pack(side="left", padx=5)
        
        self.update_chamados_list()
        
    def update_chamados_list(self):
        self.chamados_listbox.delete(0, tk.END)
        self.chamados_abertos = self.controller.central.listar_chamados_abertos()
        for chamado in self.chamados_abertos:
            tecnico_nome = chamado.get_tecnico().get_nome() if chamado.get_tecnico() else "Nenhum"
            self.chamados_listbox.insert(tk.END, f"ID: {chamado.get_id()} | Cliente: {chamado.get_cliente().get_nome()} | Descrição: {chamado.get_descricao()[:30]}... | Prioridade: {chamado.get_prioridade()} | Técnico: {tecnico_nome}")
            
        tecnicos = [u for u in self.controller.central.listar_usuarios() if isinstance(u, Tecnico)]
        self.tecnicos_map = {t.get_nome(): t for t in tecnicos}
        self.tecnicos_dropdown['values'] = list(self.tecnicos_map.keys())
        if self.tecnicos_map:
            self.tecnicos_var.set(list(self.tecnicos_map.keys())[0])

    def selecionar_chamado(self, event):
        try:
            index = self.chamados_listbox.curselection()[0]
            self.chamado_selecionado = self.chamados_abertos[index]
            messagebox.showinfo("Detalhes do Chamado", str(self.chamado_selecionado))
        except IndexError:
            pass

    def designar_tecnico(self):
        if not hasattr(self, 'chamado_selecionado'):
            messagebox.showwarning("Aviso", "Selecione um chamado primeiro.")
            return
        
        tecnico_nome = self.tecnicos_var.get()
        tecnico = self.tecnicos_map.get(tecnico_nome)
        
        if tecnico:
            self.controller.admin.designar_tecnico(self.chamado_selecionado, tecnico)
            messagebox.showinfo("Sucesso", f"Técnico {tecnico_nome} designado para o Chamado ID: {self.chamado_selecionado.get_id()}")
            self.update_chamados_list()
            if "TelaTecnico" in self.controller.frames:
                self.controller.frames["TelaTecnico"].update_chamados_list()
        else:
            messagebox.showerror("Erro", "Técnico não encontrado.")

    def setup_aba_usuarios(self):
        tk.Label(self.aba_usuarios, text="Cadastrar Novo Usuário", font=("Arial", 16)).pack(pady=5)
        
        cadastro_frame = tk.Frame(self.aba_usuarios)
        cadastro_frame.pack(pady=10)
        
        tk.Label(cadastro_frame, text="Nome:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.nome_entry = tk.Entry(cadastro_frame, width=30)
        self.nome_entry.grid(row=0, column=1, padx=5, pady=5)
        
        tk.Label(cadastro_frame, text="Email:").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.email_entry = tk.Entry(cadastro_frame, width=30)
        self.email_entry.grid(row=1, column=1, padx=5, pady=5)
        
        tk.Label(cadastro_frame, text="Senha:").grid(row=2, column=0, padx=5, pady=5, sticky="w")
        self.senha_entry = tk.Entry(cadastro_frame, width=30, show="*")
        self.senha_entry.grid(row=2, column=1, padx=5, pady=5)
        
        self.tipo_usuario_var = tk.StringVar(cadastro_frame)
        self.tipo_usuario_var.set("Cliente")
        tk.Label(cadastro_frame, text="Tipo:").grid(row=3, column=0, padx=5, pady=5, sticky="w")
        tk.OptionMenu(cadastro_frame, self.tipo_usuario_var, "Cliente", "Técnico", command=self.toggle_campos_especificos).grid(row=3, column=1, padx=5, pady=5, sticky="ew")
        
        self.campos_especificos_frame = tk.Frame(cadastro_frame)
        self.campos_especificos_frame.grid(row=4, column=0, columnspan=2, pady=5)
        self.setup_campos_cliente()
        
        tk.Button(self.aba_usuarios, text="Cadastrar", command=self.cadastrar_usuario).pack(pady=10)

    def toggle_campos_especificos(self, *args):
        for widget in self.campos_especificos_frame.winfo_children():
            widget.destroy()
            
        if self.tipo_usuario_var.get() == "Cliente":
            self.setup_campos_cliente()
        elif self.tipo_usuario_var.get() == "Técnico":
            self.setup_campos_tecnico()

    def setup_campos_cliente(self):
        tk.Label(self.campos_especificos_frame, text="Telefone:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.telefone_entry = tk.Entry(self.campos_especificos_frame, width=30)
        self.telefone_entry.grid(row=0, column=1, padx=5, pady=5)

    def setup_campos_tecnico(self):
        tk.Label(self.campos_especificos_frame, text="Especialidade:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.especialidade_entry = tk.Entry(self.campos_especificos_frame, width=30)
        self.especialidade_entry.grid(row=0, column=1, padx=5, pady=5)

    def cadastrar_usuario(self):
        nome = self.nome_entry.get()
        email = self.email_entry.get()
        senha = self.senha_entry.get()
        tipo = self.tipo_usuario_var.get()
        
        novo_usuario = None
        
        if tipo == "Cliente":
            telefone = self.telefone_entry.get()
            if nome and email and senha and telefone:
                novo_usuario = self.controller.admin.cadastrar_cliente(nome, email, senha, telefone)
            else:
                messagebox.showwarning("Aviso", "Preencha todos os campos para Cliente.")
                return
        elif tipo == "Técnico":
            especialidade = self.especialidade_entry.get()
            if nome and email and senha and especialidade:
                novo_usuario = self.controller.admin.cadastrar_tecnico(nome, email, senha, especialidade)
            else:
                messagebox.showwarning("Aviso", "Preencha todos os campos para Técnico.")
                return
                
        if novo_usuario:
            self.controller.central.adicionar_usuario(novo_usuario)
            messagebox.showinfo("Sucesso", f"{tipo} {nome} cadastrado com sucesso!")
            # Limpar campos
            self.nome_entry.delete(0, tk.END)
            self.email_entry.delete(0, tk.END)
            self.senha_entry.delete(0, tk.END)
            if tipo == "Cliente":
                self.telefone_entry.delete(0, tk.END)
            elif tipo == "Técnico":
                self.especialidade_entry.delete(0, tk.END)
            
            self.controller.frames["TelaAdmin"].update_chamados_list()

class TelaCliente(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        
        tk.Label(self, text="Área do Cliente", font=("Arial", 24)).pack(pady=10)
        
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill="both", padx=10, pady=10)
        
        self.aba_abrir = tk.Frame(self.notebook)
        self.notebook.add(self.aba_abrir, text="Abrir Chamado")
        self.setup_aba_abrir()
        
        self.aba_meus = tk.Frame(self.notebook)
        self.notebook.add(self.aba_meus, text="Meus Chamados")
        self.setup_aba_meus()
        
        # Botão de Logout
        tk.Button(self, text="Sair", command=controller.fazer_logout).pack(pady=10)
        
        self.notebook.bind("<<NotebookTabChanged>>", self.on_tab_change)

    def on_tab_change(self, event):
        selected_tab = self.notebook.tab(self.notebook.select(), "text")
        if selected_tab == "Meus Chamados":
            self.update_meus_chamados_list()

    def setup_aba_abrir(self):
        tk.Label(self.aba_abrir, text="Descreva seu problema:", font=("Arial", 14)).pack(pady=5)
        
        self.descricao_text = tk.Text(self.aba_abrir, width=60, height=10)
        self.descricao_text.pack(pady=5)
        
        prioridade_frame = tk.Frame(self.aba_abrir)
        prioridade_frame.pack(pady=5)
        tk.Label(prioridade_frame, text="Prioridade:").pack(side="left", padx=5)
        self.prioridade_var = tk.StringVar(prioridade_frame)
        self.prioridade_var.set("Normal")
        tk.OptionMenu(prioridade_frame, self.prioridade_var, "Baixa", "Normal", "Alta").pack(side="left", padx=5)
        
        tk.Button(self.aba_abrir, text="Abrir Chamado", command=self.abrir_chamado).pack(pady=10)

    def abrir_chamado(self):
        descricao = self.descricao_text.get("1.0", tk.END).strip()
        prioridade = self.prioridade_var.get()
        
        if not descricao:
            messagebox.showwarning("Aviso", "A descrição do chamado não pode estar vazia.")
            return
            
        cliente = self.controller.usuario_logado
        novo_chamado = cliente.abrir_chamado(self.controller.central, descricao, prioridade)
        
        messagebox.showinfo("Sucesso", f"Chamado ID: {novo_chamado.get_id()} aberto com sucesso!")
        self.descricao_text.delete("1.0", tk.END)
        self.prioridade_var.set("Normal")
        
        self.update_meus_chamados_list()
        if "TelaAdmin" in self.controller.frames:
            self.controller.frames["TelaAdmin"].update_chamados_list()
        
    def setup_aba_meus(self):
        tk.Label(self.aba_meus, text="Meus Chamados", font=("Arial", 16)).pack(pady=5)
        
        self.meus_chamados_listbox = tk.Listbox(self.aba_meus, width=100, height=15)
        self.meus_chamados_listbox.pack(padx=10, pady=5)
        self.meus_chamados_listbox.bind('<<ListboxSelect>>', self.selecionar_meu_chamado)
        
        self.update_meus_chamados_list()

    def update_meus_chamados_list(self):
        self.meus_chamados_listbox.delete(0, tk.END)
        if self.controller.usuario_logado and isinstance(self.controller.usuario_logado, Cliente):
            self.chamados_cliente = self.controller.usuario_logado.listar_chamados()
            for chamado in self.chamados_cliente:
                tecnico_nome = chamado.get_tecnico().get_nome() if chamado.get_tecnico() else "Nenhum"
                self.meus_chamados_listbox.insert(tk.END, f"ID: {chamado.get_id()} | Status: {chamado.get_status()} | Descrição: {chamado.get_descricao()[:30]}... | Técnico: {tecnico_nome}")

    def selecionar_meu_chamado(self, event):
        try:
            index = self.meus_chamados_listbox.curselection()[0]
            chamado_selecionado = self.chamados_cliente[index]
            messagebox.showinfo("Detalhes do Chamado", str(chamado_selecionado))
        except IndexError:
            pass

class TelaTecnico(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        
        tk.Label(self, text="Área do Técnico", font=("Arial", 24)).pack(pady=10)
        
        tk.Label(self, text="Chamados Designados", font=("Arial", 16)).pack(pady=5)
        
        self.chamados_listbox = tk.Listbox(self, width=100, height=15)
        self.chamados_listbox.pack(padx=10, pady=5)
        self.chamados_listbox.bind('<<ListboxSelect>>', self.selecionar_chamado)
        
        status_frame = tk.Frame(self)
        status_frame.pack(pady=10)
        
        tk.Label(status_frame, text="Alterar Status:").pack(side="left", padx=5)
        
        self.status_var = tk.StringVar(status_frame)
        self.status_var.set("Em andamento")
        self.status_dropdown = tk.OptionMenu(status_frame, self.status_var, "Em andamento", "Concluído", "Aberto")
        self.status_dropdown.pack(side="left", padx=5)
        
        tk.Button(status_frame, text="Atualizar Status", command=self.atualizar_status).pack(side="left", padx=5)
        
        tk.Button(self, text="Sair", command=controller.fazer_logout).pack(pady=10)
        
        self.bind('<Visibility>', self.on_show)

    def on_show(self, event):
        if self.winfo_ismapped():
            self.update_chamados_list()

    def update_chamados_list(self):
        self.chamados_listbox.delete(0, tk.END)
        self.chamados_designados = []
        tecnico_logado = self.controller.usuario_logado
        
        if tecnico_logado and isinstance(tecnico_logado, Tecnico):
            for chamado in self.controller.central.listar_chamados():
                if chamado.get_tecnico() == tecnico_logado:
                    self.chamados_designados.append(chamado)
                    self.chamados_listbox.insert(tk.END, f"ID: {chamado.get_id()} | Status: {chamado.get_status()} | Cliente: {chamado.get_cliente().get_nome()} | Descrição: {chamado.get_descricao()[:30]}...")

    def selecionar_chamado(self, event):
        try:
            index = self.chamados_listbox.curselection()[0]
            self.chamado_selecionado = self.chamados_designados[index]
            messagebox.showinfo("Detalhes do Chamado", str(self.chamado_selecionado))
        except IndexError:
            pass

    def atualizar_status(self):
        if not hasattr(self, 'chamado_selecionado'):
            messagebox.showwarning("Aviso", "Selecione um chamado primeiro.")
            return
            
        novo_status = self.status_var.get()
        tecnico = self.controller.usuario_logado
        
        if tecnico.alterar_status(self.chamado_selecionado, novo_status):
            messagebox.showinfo("Sucesso", f"Status do Chamado ID: {self.chamado_selecionado.get_id()} atualizado para '{novo_status}'.")
            self.update_chamados_list()
            if "TelaAdmin" in self.controller.frames:
                self.controller.frames["TelaAdmin"].update_chamados_list()
        else:
            messagebox.showerror("Erro", "Não foi possível atualizar o status.")


if __name__ == "__main__":
    app = AppSuporte()
    app.mainloop()
