import socket
import threading

nombre = input("Elige tu nombre de usuario: ")

cliente = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
cliente.connect(('localhost', 5000))

def recibir_mensajes():
    while True:
        try:
            mensaje = cliente.recv(1024).decode('utf-8')
            if mensaje == "NOMBRE":
                cliente.send(nombre.encode('utf-8'))
            else:
                print(mensaje)
        except:
            print("Error de conexión.")
            cliente.close()
            break

def enviar_mensajes():
    while True:
        mensaje = f"{nombre}: {input('')}"
        cliente.send(mensaje.encode('utf-8'))

hilo_recibir = threading.Thread(target=recibir_mensajes)
hilo_recibir.start()

hilo_enviar = threading.Thread(target=enviar_mensajes)
hilo_enviar.start()
