
import tkinter as tk
from tkinter import simpledialog, messagebox
import random
import os

RECORDS_FILE = "records_tablas.txt"

# ASCII art for win/lose
WIN_ART = [
    " __   __           _    _ ",
    " \ \ / /__  _   _ | | _| |",
    "  \ V / _ \| | | || |/ / |",
    "   | | (_) | |_| ||   <|_|",
    "   |_|\___/ \__,_||_|\\_(_)"
]
LOSE_ART = [
    "  _                      _ ",
    " | |    ___   __ _  ___ | |",
    " | |   / _ \ / _` |/ _ \| |",
    " | |__| (_) | (_| | (_) | |",
    " |_____\___/ \__, |\___/|_|",
    "             |___/         "
]

class JuegoTablas(tk.Toplevel):
    def __init__(self, master, nivel, nombre_jugador, volver_al_menu):
        super().__init__(master)
        self.title("Aprendamos Las Tablas")
        self.configure(bg="#f0f8ff")
        self.geometry("800x600")
        self.resizable(False, False)
        self.volver_al_menu = volver_al_menu

        self.vidas = 3
        self.puntaje = 0
        self.nombre_jugador = nombre_jugador
        self.tiempo_limite = 10
        self.remaining_time = self.tiempo_limite
        self.after_id = None

        # Difficulty range
        if nivel == "Fácil":
            self.min_val, self.max_val = 1, 5
        elif nivel == "Medio":
            self.min_val, self.max_val = 1, 10
        else:
            self.min_val, self.max_val = 5, 15

        # Top frame: hearts and score
        self.frame_top = tk.Frame(self, bg="#f0f8ff")
        self.frame_top.pack(pady=10, fill="x")
        self.hearts_frame = tk.Frame(self.frame_top, bg="#f0f8ff")
        self.hearts_frame.pack(side="left", padx=20)
        self.score_label = tk.Label(self.frame_top, text=f"Puntos: {self.puntaje}", 
                                     font=("Arial", 16), bg="#f0f8ff")
        self.score_label.pack(side="right", padx=20)
        self.update_hearts()

        # Question label
        self.pregunta_var = tk.StringVar()
        self.label_pregunta = tk.Label(self, textvariable=self.pregunta_var, 
                                        font=("Comic Sans MS", 28), bg="#f0f8ff")
        self.label_pregunta.pack(pady=20)

        # Entry
        self.entrada_usuario = tk.StringVar()
        self.entry = tk.Entry(self, textvariable=self.entrada_usuario, 
                              font=("Arial", 24), justify="center")
        self.entry.pack()

        # Submit button
        self.boton_enviar = tk.Button(self, text="Responder", command=self.verificar_respuesta,
                                      font=("Courier New", 18, "bold"), bg="#ffcc00", fg="#000",
                                      activebackground="#ff9900", relief=tk.RIDGE, borderwidth=6)
        self.boton_enviar.pack(pady=10)

        # Timer bar
        self.timer_canvas = tk.Canvas(self, width=600, height=20, bg="white", highlightthickness=1, highlightbackground="black")
        self.timer_canvas.pack(pady=10)
        self.timer_bar = self.timer_canvas.create_rectangle(0, 0, 600, 20, fill="green")

        # In-game message label
        self.mensaje_label = tk.Label(self, text="", font=("Courier New", 16), bg="#f0f8ff")
        self.mensaje_label.pack(pady=10)

        # Start first question
        self.nueva_pregunta()

    def update_hearts(self):
        for widget in self.hearts_frame.winfo_children():
            widget.destroy()
        for i in range(self.vidas):
            lbl = tk.Label(self.hearts_frame, text="❤️", font=("Arial", 24), bg="#f0f8ff")
            lbl.pack(side="left", padx=2)

    def nueva_pregunta(self):
        if self.after_id:
            self.after_cancel(self.after_id)
        self.remaining_time = self.tiempo_limite
        while True:
            a = random.randint(self.min_val, self.max_val)
            b = random.randint(self.min_val, self.max_val)
            if (a, b) != getattr(self, "last_q", None):
                self.last_q = (a, b)
                break
        self.a, self.b = a, b
        self.pregunta_var.set(f"¿Cuánto es {a} x {b}?")
        self.entrada_usuario.set("")
        self.entry.focus()
        self.update_timer()

    def update_timer(self):
        width = int(600 * (self.remaining_time / self.tiempo_limite))
        self.timer_canvas.coords(self.timer_bar, 0, 0, width, 20)
        if self.remaining_time > 0:
            self.remaining_time -= 1
            self.after_id = self.after(1000, self.update_timer)
        else:
            self.time_out()

    def mostrar_ascii(self, art_list, color):
        text = "\n".join(art_list)
        self.mensaje_label.config(text=text, fg=color)
        self.after(1500, lambda: self.mensaje_label.config(text=""))

    def time_out(self):
        self.vidas -= 1
        self.update_hearts()
        self.mostrar_ascii(LOSE_ART, "red")
        self.comprobar_estado()

    def verificar_respuesta(self):
        if self.after_id:
            self.after_cancel(self.after_id)
        try:
            respuesta = int(self.entrada_usuario.get())
        except ValueError:
            self.mensaje_label.config(text="¡Entrada inválida!", fg="orange")
            return
        if respuesta == self.a * self.b:
            self.puntaje += 1
            self.score_label.config(text=f"Puntos: {self.puntaje}")
            self.mostrar_ascii(WIN_ART, "green")
        else:
            self.vidas -= 1
            self.update_hearts()
            self.mostrar_ascii(LOSE_ART, "red")
        self.comprobar_estado()

    def comprobar_estado(self):
        if self.vidas <= 0:
            self.guardar_record()
            self.mostrar_records_popup()
            self.destroy()
            self.volver_al_menu()
        else:
            self.after(1500, self.nueva_pregunta)

    def guardar_record(self):
        with open(RECORDS_FILE, "a", encoding="utf-8") as f:
            f.write(f"{self.nombre_jugador}:{self.puntaje}\n")

    def mostrar_records_popup(self):
        if not os.path.exists(RECORDS_FILE):
            return
        with open(RECORDS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
        records = []
        for line in lines:
            try:
                n, p = line.strip().split(":")
                records.append((n, int(p)))
            except:
                continue
        records.sort(key=lambda x: x[1], reverse=True)
        top5 = records[:5]
        msg = "\n".join([f"{i+1}. {n} - {p} pts" for i,(n,p) in enumerate(top5)])
        messagebox.showinfo("🏆 Mejores Puntajes", msg)

class MenuPrincipal:
    def __init__(self):
        self.ventana = tk.Tk()
        self.ventana.title("Aprendamos Las Tablas")
        self.ventana.configure(bg="#ffefd5")
        self.ventana.geometry("800x600")
        self.ventana.resizable(False, False)

        self.titulo = tk.Label(self.ventana, text="Aprendamos Las Tablas",
                               font=("Comic Sans MS", 36, "bold"), fg="#ff1493", bg="#ffefd5")
        self.titulo.pack(pady=40)

        # Styled buttons with hover effect
        self.create_button("Iniciar", self.seleccionar_dificultad, "#90ee90")
        self.create_button("Records", self.mostrar_records, "#add8e6")

        self.ventana.mainloop()

    def create_button(self, text, cmd, bg_color):
        btn = tk.Button(self.ventana, text=text, command=cmd,
                        font=("Courier New", 24, "bold"), bg=bg_color,
                        fg="#000", activebackground="#ffd700",
                        relief=tk.RAISED, bd=8)
        btn.pack(pady=20, ipadx=20, ipady=10)
        # Hover effects
        btn.bind("<Enter>", lambda e: btn.config(bg="#ffd700"))
        btn.bind("<Leave>", lambda e: btn.config(bg=bg_color))

    def seleccionar_dificultad(self):
        self.ventana.withdraw()
        nombre = simpledialog.askstring("Nombre", "¿Cómo te llamas?", parent=self.ventana)
        if not nombre:
            messagebox.showwarning("Nombre requerido", "Debes ingresar un nombre para jugar.", parent=self.ventana)
            self.ventana.deiconify()
            return
        top = tk.Toplevel(self.ventana)
        top.title("Selecciona la dificultad")
        top.configure(bg="#e0f7fa")
        top.geometry("400x300")
        tk.Label(top, text="Elige el nivel de dificultad",
                 font=("Comic Sans MS", 20), bg="#e0f7fa").pack(pady=20)
        for nivel in ["Fácil", "Medio", "Difícil"]:
            btn = tk.Button(top, text=nivel, command=lambda n=nivel: self.iniciar_juego(n, nombre, top),
                            font=("Arial", 18), bg="#b2ebf2", relief=tk.RAISED, bd=6)
            btn.pack(pady=10, ipadx=10, ipady=5)

    def iniciar_juego(self, nivel, nombre, menu):
        menu.destroy()
        JuegoTablas(self.ventana, nivel, nombre, self.volver_al_menu)

    def mostrar_records(self):
        if not os.path.exists(RECORDS_FILE):
            messagebox.showinfo("Records", "No hay récords guardados aún.", parent=self.ventana)
            return
        with open(RECORDS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
        recs = []
        for line in lines:
            try:
                n, p = line.strip().split(":")
                recs.append((n, int(p)))
            except:
                continue
        recs.sort(key=lambda x: x[1], reverse=True)
        top5 = recs[:5]
        msg = "\n".join([f"{i+1}. {n} - {p} pts" for i,(n,p) in enumerate(top5)])
        messagebox.showinfo("🏆 Mejores Puntajes", msg, parent=self.ventana)

    def volver_al_menu(self):
        self.ventana.deiconify()

if __name__ == "__main__":
    MenuPrincipal()
