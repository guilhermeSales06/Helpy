from classes import *


if __name__ == "__main__":
    central = CentralDeSuporte()
    admin = Administrador(1, "ROlt", "rolt@suporte.com", "1234")
    central.adicionar_usuario(admin)
    print("Administrador criado:")
    print(admin)
    print("-" * 50)

    cliente1 = admin.cadastrar_cliente("rafael", "rafael@email.com", "abcd", "11999999999")
    tecnico1 = admin.cadastrar_tecnico("guilherme", "guilherme@tech.com", "4321", "Hardware")
    central.adicionar_usuario(cliente1)
    central.adicionar_usuario(tecnico1)

    print("Usuários cadastrados:")
    for u in central.listar_usuarios():
        print(u)
        print("-" * 30)

    chamado1 = cliente1.abrir_chamado(central, "Computador não liga", "Alta")
    print("Chamado aberto:")
    print(chamado1)
    print("-" * 50)

    admin.designar_tecnico(chamado1, tecnico1)
    print("Chamado após designaçao do técnico:")
    print(chamado1)
    print("-" * 50)

    tecnico1.alterar_status(chamado1, "Em andamento")
    print("Chamado atualizado:")
    print(chamado1)
    print("-" * 50)

    tecnico1.alterar_status(chamado1, "Concluído")
    print("Chamado concluído:")
    print(chamado1)
    print("-" * 50)

    relatorio = admin.gerar_relatorio(central.listar_chamados())
    print("Relatório de chamados:")
    print(relatorio)
