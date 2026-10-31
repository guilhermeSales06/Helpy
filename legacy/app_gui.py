import tkinter as tk
from tkinter import messagebox
import tkinter.ttk as ttk
from classes import *
from database import DatabaseManager

class AppSuporte(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Sistema de Central de Suporte")
        self.geometry("1100x750")
        self.resizable(False, False)
        
        # Definir tema visual
        self.configure(bg="#f5f7fa")
        
        # Configurar cores do ttk
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TNotebook', background="#f5f7fa", borderwidth=0)
        style.configure('TNotebook.Tab', padding=[40, 15], background="#e8ecf1", font=('Segoe UI', 9, 'bold'))
        style.configure('TFrame', background="#f5f7fa")
        style.map('TNotebook.Tab',
                  background=[('selected', '#3498db')],
                  foreground=[('selected', 'white')],
                  relief=[('selected', 'flat')])
        
        self.db_manager = DatabaseManager()
        
        self.central = CentralDeSuporte(self.db_manager)
        
        self.admin = self.db_manager.get_usuario_by_email("rolt@suporte.com")
        
        if not self.db_manager.get_usuario_by_email("rafael@email.com"):
            self.admin.cadastrar_cliente(self.db_manager, "rafael", "rafael@email.com", "abcd", "11999999999")
        if not self.db_manager.get_usuario_by_email("guilherme@tech.com"):
            self.admin.cadastrar_tecnico(self.db_manager, "guilherme", "guilherme@tech.com", "4321", "Hardware")
        
        if not self.central.listar_chamados():
            cliente_teste = self.db_manager.get_usuario_by_email("rafael@email.com")
            if cliente_teste:
                cliente_teste.abrir_chamado(self.db_manager, "Computador não liga", "Alta")
        
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
        # Busca o usuário no banco de dados
        usuario = self.db_manager.get_usuario_by_email(email)
        
        if usuario and usuario.autenticar(email, senha):
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
        
    def destroy(self):
        self.db_manager.close()
        super().destroy()


class TelaLogin(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent, bg="#f5f7fa")
        self.controller = controller
        
        # Container centralizado
        main_container = tk.Frame(self, bg="#f5f7fa")
        main_container.place(relx=0.5, rely=0.5, anchor="center")
        
        # Título
        title_label = tk.Label(main_container, text="🎯 Sistema de Suporte", 
                              font=("Segoe UI", 36, "bold"), bg="#f5f7fa", fg="#1a1a1a")
        title_label.pack(pady=(0, 5), anchor="center")
        
        subtitle_label = tk.Label(main_container, text="Central de Atendimento Inteligente", 
                                 font=("Segoe UI", 13), bg="#f5f7fa", fg="#666")
        subtitle_label.pack(pady=(0, 35), anchor="center")
        
        # Frame de login com sombra
        shadow_frame = tk.Frame(main_container, bg="#d0d5dd", highlightthickness=0)
        shadow_frame.pack(padx=6, pady=6)
        
        login_frame = tk.Frame(shadow_frame, bg="white", relief="flat", highlightthickness=0)
        login_frame.pack(padx=2, pady=2)
        
        # Email
        tk.Label(login_frame, text="📧 Email", font=("Segoe UI", 10, "bold"), 
                bg="white", fg="#1a1a1a").pack(pady=(18, 8), padx=20, anchor="w")
        self.email_entry = tk.Entry(login_frame, width=35, font=("Segoe UI", 10), 
                                    relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a")
        self.email_entry.pack(pady=(0, 15), padx=20, ipady=8)
        
        # Senha
        tk.Label(login_frame, text="🔐 Senha", font=("Segoe UI", 10, "bold"), 
                bg="white", fg="#1a1a1a").pack(pady=(0, 8), padx=20, anchor="w")
        self.senha_entry = tk.Entry(login_frame, width=35, font=("Segoe UI", 10), 
                                   show="•", relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a")
        self.senha_entry.pack(pady=(0, 25), padx=20, ipady=8)
        
        # Botão de login
        login_button = tk.Button(login_frame, text="→ Entrar", command=self.login,
                                font=("Segoe UI", 11, "bold"), bg="#3498db", 
                                fg="white", relief="flat", padx=50, pady=10,
                                cursor="hand2", activebackground="#2980b9", highlightthickness=0, bd=0)
        login_button.pack(pady=(0, 20), padx=20, fill="x")
        
        # Dados de teste
        test_frame = tk.Frame(main_container, bg="white", relief="flat", highlightthickness=0)
        test_frame.pack(padx=30, pady=(25, 0), fill="x")
        
        test_label = tk.Label(test_frame, text="📋 Dados de Teste", 
                             font=("Segoe UI", 9, "bold"), bg="white", fg="#1a1a1a")
        test_label.pack(pady=(12, 10), anchor="w", padx=15)
        
        test_data = [
            "👤 Admin: rolt@suporte.com / 1234",
            "👥 Cliente: rafael@email.com / abcd",
            "🔧 Técnico: guilherme@tech.com / 4321"
        ]
        
        for data in test_data:
            tk.Label(test_frame, text=data, font=("Segoe UI", 8), 
                    bg="white", fg="#888").pack(anchor="w", padx=15, pady=2)
        
        tk.Label(test_frame, text="", bg="white").pack(pady=8)

    def login(self):
        email = self.email_entry.get()
        senha = self.senha_entry.get()
        self.controller.fazer_login(email, senha)
        
class TelaAdmin(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent, bg="#f5f7fa")
        self.controller = controller
        
        # Header
        header_frame = tk.Frame(self, bg="#1a3a52", height=85, highlightthickness=0)
        header_frame.pack(fill="x")
        header_frame.pack_propagate(False)
        
        tk.Label(header_frame, text="⚙️ Administrador", font=("Segoe UI", 26, "bold"), 
                bg="#1a3a52", fg="white").pack(pady=15)
        
        # Notebook
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill="both", padx=15, pady=15)
        
        self.aba_chamados = tk.Frame(self.notebook, bg="white")
        self.notebook.add(self.aba_chamados, text="📋 Chamados")
        self.setup_aba_chamados()
        
        self.aba_usuarios = tk.Frame(self.notebook, bg="white")
        self.notebook.add(self.aba_usuarios, text="👥 Usuários")
        self.setup_aba_usuarios()
        
        # Footer com botão sair
        footer_frame = tk.Frame(self, bg="#f5f7fa", highlightthickness=0)
        footer_frame.pack(fill="x", pady=12)
        
        logout_button = tk.Button(footer_frame, text="← Sair", command=controller.fazer_logout,
                                 font=("Segoe UI", 10, "bold"), bg="#e74c3c", fg="white",
                                 relief="flat", padx=35, pady=8, cursor="hand2",
                                 activebackground="#c0392b", highlightthickness=0, bd=0)
        logout_button.pack(anchor="center")

    def setup_aba_chamados(self):
        # Container centralizado
        container = tk.Frame(self.aba_chamados, bg="white", highlightthickness=0)
        container.pack(fill="both", expand=True, padx=12, pady=12)
        
        tk.Label(container, text="📌 Chamados Abertos", font=("Segoe UI", 13, "bold"), 
                bg="white", fg="#1a1a1a").pack(pady=(0, 12), anchor="w")
        
        # Listbox com scrollbar
        scrollbar_frame = tk.Frame(container, bg="white", highlightthickness=0)
        scrollbar_frame.pack(fill="both", expand=True, pady=(0, 15))
        
        scrollbar = tk.Scrollbar(scrollbar_frame)
        scrollbar.pack(side="right", fill="y")
        
        self.chamados_listbox = tk.Listbox(scrollbar_frame, width=130, height=11,
                                          font=("Segoe UI", 8), yscrollcommand=scrollbar.set,
                                          relief="flat", borderwidth=1, bg="#f8f9fa", fg="#1a1a1a",
                                          selectbackground="#3498db", selectforeground="white", highlightthickness=0)
        self.chamados_listbox.pack(fill="both", expand=True)
        scrollbar.config(command=self.chamados_listbox.yview)
        self.chamados_listbox.bind('<<ListboxSelect>>', self.selecionar_chamado)
        
        # Frame de designação
        designar_frame = tk.Frame(container, bg="white", highlightthickness=0)
        designar_frame.pack(pady=12, anchor="center")
        
        tk.Label(designar_frame, text="🎯 Designar Técnico:", font=("Segoe UI", 10, "bold"), 
                bg="white", fg="#1a1a1a").pack(side="left", padx=8)
        
        self.tecnicos_var = tk.StringVar(designar_frame)
        self.tecnicos_dropdown = ttk.Combobox(designar_frame, textvariable=self.tecnicos_var, 
                                             state="readonly", width=22, font=("Segoe UI", 9))
        self.tecnicos_dropdown.pack(side="left", padx=8)
        
        designar_button = tk.Button(designar_frame, text="✓ Designar", command=self.designar_tecnico,
                                   font=("Segoe UI", 9, "bold"), bg="#27ae60", fg="white",
                                   relief="flat", padx=18, cursor="hand2", activebackground="#229954", highlightthickness=0, bd=0)
        designar_button.pack(side="left", padx=8)
        
        self.update_chamados_list()
        
    def update_chamados_list(self):
        self.chamados_listbox.delete(0, tk.END)
        self.chamados_abertos = self.controller.central.listar_chamados_abertos()
        for chamado in self.chamados_abertos:
            tecnico_nome = chamado.get_tecnico().get_nome() if chamado.get_tecnico() else "Nenhum"
            self.chamados_listbox.insert(tk.END, f"ID: {chamado.get_id()} | Cliente: {chamado.get_cliente().get_nome()} | Descrição: {chamado.get_descricao()[:30]}... | Prioridade: {chamado.get_prioridade()} | Técnico: {tecnico_nome}")
            
        tecnicos = self.controller.db_manager.get_all_tecnicos()
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
            if self.controller.admin.designar_tecnico(self.controller.db_manager, self.chamado_selecionado, tecnico):
                messagebox.showinfo("Sucesso", f"Técnico {tecnico_nome} designado para o Chamado ID: {self.chamado_selecionado.get_id()}")
                self.update_chamados_list()
          
                if "TelaTecnico" in self.controller.frames:
                    self.controller.frames["TelaTecnico"].update_chamados_list()
            else:
                messagebox.showerror("Erro", "Não foi possível designar o técnico.")
        else:
            messagebox.showerror("Erro", "Técnico não encontrado.")

    def setup_aba_usuarios(self):
        container = tk.Frame(self.aba_usuarios, bg="white", highlightthickness=0)
        container.pack(fill="both", expand=True, padx=12, pady=12)
        
        tk.Label(container, text="➕ Cadastrar Novo Usuário", font=("Segoe UI", 13, "bold"), 
                bg="white", fg="#1a1a1a").pack(pady=(0, 18), anchor="w")
        
        # Frame de cadastro
        cadastro_frame = tk.Frame(container, bg="white", highlightthickness=0)
        cadastro_frame.pack(pady=0, anchor="center")
        
        tk.Label(cadastro_frame, text="Nome:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").grid(row=0, column=0, padx=12, pady=8, sticky="w")
        self.nome_entry = tk.Entry(cadastro_frame, width=30, font=("Segoe UI", 10), 
                                  relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a")
        self.nome_entry.grid(row=0, column=1, padx=12, pady=8, ipady=6)
        
        tk.Label(cadastro_frame, text="Email:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").grid(row=1, column=0, padx=12, pady=8, sticky="w")
        self.email_entry = tk.Entry(cadastro_frame, width=30, font=("Segoe UI", 10), 
                                   relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a")
        self.email_entry.grid(row=1, column=1, padx=12, pady=8, ipady=6)
        
        tk.Label(cadastro_frame, text="Senha:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").grid(row=2, column=0, padx=12, pady=8, sticky="w")
        self.senha_entry = tk.Entry(cadastro_frame, width=30, font=("Segoe UI", 10), 
                                   show="•", relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a")
        self.senha_entry.grid(row=2, column=1, padx=12, pady=8, ipady=6)
        
        self.tipo_usuario_var = tk.StringVar(cadastro_frame)
        self.tipo_usuario_var.set("Cliente")
        tk.Label(cadastro_frame, text="Tipo:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").grid(row=3, column=0, padx=12, pady=8, sticky="w")
        tipo_menu = ttk.Combobox(cadastro_frame, textvariable=self.tipo_usuario_var, 
                               values=["Cliente", "Técnico"], state="readonly", width=27, 
                               font=("Segoe UI", 9))
        tipo_menu.grid(row=3, column=1, padx=12, pady=8)
        tipo_menu.bind("<<ComboboxSelected>>", self.toggle_campos_especificos)
        
        self.campos_especificos_frame = tk.Frame(cadastro_frame, bg="white", highlightthickness=0)
        self.campos_especificos_frame.grid(row=4, column=0, columnspan=2, pady=10)
        self.setup_campos_cliente()
        
        # Botão Cadastrar
        cadastro_button = tk.Button(container, text="✓ Cadastrar", command=self.cadastrar_usuario,
                                   font=("Segoe UI", 10, "bold"), bg="#3498db", fg="white",
                                   relief="flat", padx=40, pady=9, cursor="hand2",
                                   activebackground="#2980b9", highlightthickness=0, bd=0)
        cadastro_button.pack(pady=15)

    def toggle_campos_especificos(self, *args):
        for widget in self.campos_especificos_frame.winfo_children():
            widget.destroy()
            
        if self.tipo_usuario_var.get() == "Cliente":
            self.setup_campos_cliente()
        elif self.tipo_usuario_var.get() == "Técnico":
            self.setup_campos_tecnico()

    def setup_campos_cliente(self):
        for widget in self.campos_especificos_frame.winfo_children():
            widget.destroy()
        
        tk.Label(self.campos_especificos_frame, text="Telefone:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").grid(row=0, column=0, padx=10, pady=8, sticky="w")
        self.telefone_entry = tk.Entry(self.campos_especificos_frame, width=27, font=("Segoe UI", 10), 
                                      relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a")
        self.telefone_entry.grid(row=0, column=1, padx=10, pady=8, ipady=6)

    def setup_campos_tecnico(self):
        for widget in self.campos_especificos_frame.winfo_children():
            widget.destroy()
        
        tk.Label(self.campos_especificos_frame, text="Especialidade:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").grid(row=0, column=0, padx=10, pady=8, sticky="w")
        self.especialidade_entry = tk.Entry(self.campos_especificos_frame, width=27, font=("Segoe UI", 10), 
                                           relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a")
        self.especialidade_entry.grid(row=0, column=1, padx=10, pady=8, ipady=6)

    def cadastrar_usuario(self):
        nome = self.nome_entry.get()
        email = self.email_entry.get()
        senha = self.senha_entry.get()
        tipo = self.tipo_usuario_var.get()
        
        novo_usuario = None
        
        if tipo == "Cliente":
            telefone = self.telefone_entry.get()
            if nome and email and senha and telefone:
                novo_usuario = self.controller.admin.cadastrar_cliente(self.controller.db_manager, nome, email, senha, telefone)
            else:
                messagebox.showwarning("Aviso", "Preencha todos os campos para Cliente.")
                return
        elif tipo == "Técnico":
            especialidade = self.especialidade_entry.get()
            if nome and email and senha and especialidade:
                novo_usuario = self.controller.admin.cadastrar_tecnico(self.controller.db_manager, nome, email, senha, especialidade)
            else:
                messagebox.showwarning("Aviso", "Preencha todos os campos para Técnico.")
                return
                
        if novo_usuario:
            messagebox.showinfo("Sucesso", f"{tipo} {nome} cadastrado com sucesso!")
            self.nome_entry.delete(0, tk.END)
            self.email_entry.delete(0, tk.END)
            self.senha_entry.delete(0, tk.END)
            if tipo == "Cliente":
                self.telefone_entry.delete(0, tk.END)
            elif tipo == "Técnico":
                self.especialidade_entry.delete(0, tk.END)
            
            self.controller.frames["TelaAdmin"].update_chamados_list()
        else:
            messagebox.showerror("Erro", "Não foi possível cadastrar o usuário. O email pode já estar em uso.")

class TelaCliente(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent, bg="#f5f7fa")
        self.controller = controller
        
        # Header
        header_frame = tk.Frame(self, bg="#1a3a52", height=85, highlightthickness=0)
        header_frame.pack(fill="x")
        
        tk.Label(header_frame, text="👥 Cliente", font=("Segoe UI", 26, "bold"), 
                bg="#1a3a52", fg="white").pack(pady=15)
        
        # Notebook
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill="both", padx=20, pady=20)
        
        self.aba_abrir = tk.Frame(self.notebook, bg="white")
        self.notebook.add(self.aba_abrir, text="📝 Novo Chamado")
        self.setup_aba_abrir()
        
        self.aba_meus = tk.Frame(self.notebook, bg="white")
        self.notebook.add(self.aba_meus, text="📌 Meus Chamados")
        self.setup_aba_meus()
        
        # Footer com botão sair
        footer_frame = tk.Frame(self, bg="#f5f7fa", highlightthickness=0)
        footer_frame.pack(fill="x", pady=10)
        
        logout_button = tk.Button(footer_frame, text="← Sair", command=controller.fazer_logout,
                                 font=("Segoe UI", 10, "bold"), bg="#e74c3c", fg="white",
                                 relief="flat", padx=30, pady=8, cursor="hand2",
                                 activebackground="#c0392b", highlightthickness=0, bd=0)
        logout_button.pack()
        
        self.notebook.bind("<<NotebookTabChanged>>", self.on_tab_change)

    def on_tab_change(self, event):
        selected_tab = self.notebook.tab(self.notebook.select(), "text")
        if selected_tab == "Meus Chamados":
            self.update_meus_chamados_list()

    def setup_aba_abrir(self):
        container = tk.Frame(self.aba_abrir, bg="white", highlightthickness=0)
        container.pack(fill="both", expand=True, padx=12, pady=12)
        
        tk.Label(container, text="📝 Abrir Novo Chamado", font=("Segoe UI", 13, "bold"), 
                bg="white", fg="#1a1a1a").pack(pady=(0, 15), anchor="w")
        
        tk.Label(container, text="Descrição do Problema:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").pack(pady=(0, 8), anchor="w", padx=12)
        
        self.descricao_text = tk.Text(container, width=70, height=10, font=("Segoe UI", 10),
                                     relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a")
        self.descricao_text.pack(pady=(0, 18), expand=True, fill="both", padx=12)
        
        prioridade_frame = tk.Frame(container, bg="white", highlightthickness=0)
        prioridade_frame.pack(pady=0, anchor="center")
        
        tk.Label(prioridade_frame, text="⚡ Prioridade:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").pack(side="left", padx=5)
        
        self.prioridade_var = tk.StringVar(prioridade_frame)
        self.prioridade_var.set("Normal")
        
        priority_dropdown = ttk.Combobox(prioridade_frame, textvariable=self.prioridade_var, 
                                        values=["Baixa", "Normal", "Alta"], state="readonly", 
                                        width=20, font=("Segoe UI", 10))
        priority_dropdown.pack(side="left", padx=5)
        
        open_button = tk.Button(container, text="✓ Abrir Chamado", command=self.abrir_chamado,
                               font=("Segoe UI", 10, "bold"), bg="#27ae60", fg="white",
                               relief="flat", padx=40, pady=9, cursor="hand2",
                               activebackground="#229954", highlightthickness=0, bd=0)
        open_button.pack(pady=15)

    def abrir_chamado(self):
        descricao = self.descricao_text.get("1.0", tk.END).strip()
        prioridade = self.prioridade_var.get()
        
        if not descricao:
            messagebox.showwarning("Aviso", "A descrição do chamado não pode estar vazia.")
            return
            
        cliente = self.controller.usuario_logado
        novo_chamado = cliente.abrir_chamado(self.controller.db_manager, descricao, prioridade)
        
        if novo_chamado:
            messagebox.showinfo("Sucesso", f"Chamado ID: {novo_chamado.get_id()} aberto com sucesso!")
            self.descricao_text.delete("1.0", tk.END)
            self.prioridade_var.set("Normal")
            
            self.update_meus_chamados_list()
            if "TelaAdmin" in self.controller.frames:
                self.controller.frames["TelaAdmin"].update_chamados_list()
        else:
            messagebox.showerror("Erro", "Não foi possível abrir o chamado.")
        
    def setup_aba_meus(self):
        container = tk.Frame(self.aba_meus, bg="white", highlightthickness=0)
        container.pack(fill="both", expand=True, padx=12, pady=12)
        
        tk.Label(container, text="📌 Meus Chamados", font=("Segoe UI", 13, "bold"), 
                bg="white", fg="#1a1a1a").pack(pady=(0, 12), anchor="w")
        
        # Listbox com scrollbar
        scrollbar_frame = tk.Frame(container, bg="white", highlightthickness=0)
        scrollbar_frame.pack(fill="both", expand=True)
        
        scrollbar = tk.Scrollbar(scrollbar_frame)
        scrollbar.pack(side="right", fill="y")
        
        self.meus_chamados_listbox = tk.Listbox(scrollbar_frame, width=120, height=15,
                                               font=("Segoe UI", 9), yscrollcommand=scrollbar.set,
                                               relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a",
                                               selectbackground="#3498db", selectforeground="white")
        self.meus_chamados_listbox.pack(fill="both", expand=True)
        scrollbar.config(command=self.meus_chamados_listbox.yview)
        self.meus_chamados_listbox.bind('<<ListboxSelect>>', self.selecionar_meu_chamado)
        
        self.update_meus_chamados_list()

    def update_meus_chamados_list(self):
        self.meus_chamados_listbox.delete(0, tk.END)
        if self.controller.usuario_logado and isinstance(self.controller.usuario_logado, Cliente):
            self.chamados_cliente = self.controller.usuario_logado.listar_chamados(self.controller.db_manager)
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
        super().__init__(parent, bg="#f5f7fa")
        self.controller = controller
        
        # Header
        header_frame = tk.Frame(self, bg="#1a3a52", height=85, highlightthickness=0)
        header_frame.pack(fill="x")
        
        tk.Label(header_frame, text="🔧 Técnico", font=("Segoe UI", 26, "bold"), 
                bg="#1a3a52", fg="white").pack(pady=15)
        
        # Container principal
        main_container = tk.Frame(self, bg="white", highlightthickness=0)
        main_container.pack(fill="both", expand=True, padx=12, pady=12)
        
        tk.Label(main_container, text="📌 Chamados Designados", font=("Segoe UI", 13, "bold"), 
                bg="white", fg="#1a1a1a").pack(pady=(0, 12), anchor="w")
        
        # Listbox com scrollbar
        scrollbar_frame = tk.Frame(main_container, bg="white", highlightthickness=0)
        scrollbar_frame.pack(fill="both", expand=True, pady=(0, 15))
        
        scrollbar = tk.Scrollbar(scrollbar_frame)
        scrollbar.pack(side="right", fill="y")
        
        self.chamados_listbox = tk.Listbox(scrollbar_frame, width=120, height=15,
                                          font=("Segoe UI", 9), yscrollcommand=scrollbar.set,
                                          relief="flat", borderwidth=0, bg="#f8f9fa", fg="#1a1a1a",
                                          selectbackground="#3498db", selectforeground="white")
        self.chamados_listbox.pack(fill="both", expand=True)
        scrollbar.config(command=self.chamados_listbox.yview)
        self.chamados_listbox.bind('<<ListboxSelect>>', self.selecionar_chamado)
        
        # Frame de status
        status_frame = tk.Frame(main_container, bg="white", highlightthickness=0)
        status_frame.pack(pady=15, fill="x", expand=False, anchor="center")
        
        tk.Label(status_frame, text="📊 Status:", font=("Segoe UI", 9, "bold"), 
                bg="white", fg="#1a1a1a").pack(side="left", padx=5)
        
        self.status_var = tk.StringVar(status_frame)
        self.status_var.set("Em andamento")
        
        self.status_dropdown = ttk.Combobox(status_frame, textvariable=self.status_var,
                                           values=["Em andamento", "Concluído", "Aberto"],
                                           state="readonly", width=20, font=("Segoe UI", 10))
        self.status_dropdown.pack(side="left", padx=5)
        
        update_button = tk.Button(status_frame, text="✓ Atualizar", command=self.atualizar_status,
                                 font=("Segoe UI", 10, "bold"), bg="#f39c12", fg="white",
                                 relief="flat", padx=20, cursor="hand2", activebackground="#e67e22",
                                 highlightthickness=0, bd=0)
        update_button.pack(side="left", padx=5)
        
        # Footer com botão sair
        footer_frame = tk.Frame(self, bg="#f5f7fa", highlightthickness=0)
        footer_frame.pack(fill="x", pady=10)
        
        logout_button = tk.Button(footer_frame, text="← Sair", command=controller.fazer_logout,
                                 font=("Segoe UI", 10, "bold"), bg="#e74c3c", fg="white",
                                 relief="flat", padx=30, pady=8, cursor="hand2",
                                 activebackground="#c0392b", highlightthickness=0, bd=0)
        logout_button.pack()
        
        self.bind('<Visibility>', self.on_show)

    def on_show(self, event):
        if self.winfo_ismapped():
            self.update_chamados_list()

    def update_chamados_list(self):
        self.chamados_listbox.delete(0, tk.END)
        self.chamados_designados = []
        tecnico_logado = self.controller.usuario_logado
        
        if tecnico_logado and isinstance(tecnico_logado, Tecnico):
            self.chamados_designados = self.controller.db_manager.get_chamados_by_tecnico(tecnico_logado.get_id())
            
            for chamado in self.chamados_designados:
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
        
        if tecnico.alterar_status(self.controller.db_manager, self.chamado_selecionado, novo_status):
            messagebox.showinfo("Sucesso", f"Status do Chamado ID: {self.chamado_selecionado.get_id()} atualizado para '{novo_status}'.")
            self.update_chamados_list()
            if "TelaAdmin" in self.controller.frames:
                self.controller.frames["TelaAdmin"].update_chamados_list()
        else:
            messagebox.showerror("Erro", "Não foi possível atualizar o status.")


if __name__ == "__main__":
    app = AppSuporte()
    app.mainloop()
