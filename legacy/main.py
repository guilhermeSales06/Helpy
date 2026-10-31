from classes import *
from database import DatabaseManager

if __name__ == "__main__":

    db_manager = DatabaseManager()
    db_manager.execute_query("DELETE FROM chamados")
    db_manager.execute_query("DELETE FROM clientes")
    db_manager.execute_query("DELETE FROM tecnicos")
    db_manager.execute_query("DELETE FROM usuarios WHERE tipo != 'Administrador'")

    central = CentralDeSuporte(db_manager)

    admin = db_manager.get_usuario_by_email("rolt@suporte.com")
    
    print("Administrador carregado:")
    print(admin)
    print("-" * 50)

    cliente1 = admin.cadastrar_cliente(db_manager, "rafael", "rafael@email.com", "abcd", "11999999999")
    tecnico1 = admin.cadastrar_tecnico(db_manager, "guilherme", "guilherme@tech.com", "4321", "Hardware")
    
    print("Usuários cadastrados:")
    for u in central.listar_usuarios():
        print(u)
        print("-" * 30)

    chamado1 = cliente1.abrir_chamado(db_manager, "Computador não liga", "Alta")
    print("Chamado aberto:")
    print(chamado1)
    print("-" * 50)

    admin.designar_tecnico(db_manager, chamado1, tecnico1)
    print("Chamado após designaçao do técnico:")
    print(chamado1)
    print("-" * 50)

    tecnico1.alterar_status(db_manager, chamado1, "Em andamento")
    print("Chamado atualizado:")
    print(chamado1)
    print("-" * 50)

    tecnico1.alterar_status(db_manager, chamado1, "Concluído")
    print("Chamado concluído:")
    print(chamado1)
    print("-" * 50)

    relatorio = admin.gerar_relatorio(central.listar_chamados())
    print("Relatório de chamados:")
    print(relatorio)
    
    db_manager.close()
