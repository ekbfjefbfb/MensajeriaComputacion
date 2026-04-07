import socket
import threading

# Configuración del servidor
host = 'localhost'
port = 5000

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind((host, port))
server.listen()

clientes = []
nombres = []

def difundir(mensaje, _cliente):
    for cliente in clientes:
        if cliente != _cliente:
            cliente.send(mensaje)

def manejar_mensajes(cliente):
    while True:
        try:
            mensaje = cliente.recv(1024)
            difundir(mensaje, cliente)
        except:
            indice = clientes.index(cliente)
            clientes.remove(cliente)
            cliente.close()
            nombre = nombres[indice]
            print(f"{nombre} se ha desconectado.")
            nombres.remove(nombre)
            break

def recibir_conexiones():
    print("--- SERVIDOR DE CHAT EN VIVO (WHATSAPP DEMO) ---")
    print(f"Escuchando en {host}:{port}...")
    while True:
        cliente, direccion = server.accept()
        print(f"Nueva conexión desde {direccion}")

        cliente.send("NOMBRE".encode('utf-8'))
        nombre = cliente.recv(1024).decode('utf-8')
        
        nombres.append(nombre)
        clientes.append(cliente)

        print(f"El usuario es: {nombre}")
        difundir(f"{nombre} se unió al chat!".encode('utf-8'), cliente)
        cliente.send("Conectado al servidor de mensajería.".encode('utf-8'))

        hilo = threading.Thread(target=manejar_mensajes, args=(cliente,))
        hilo.start()

recibir_conexiones()
