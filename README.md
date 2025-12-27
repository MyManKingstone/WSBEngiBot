# WSB Engi Bot

Bot Discord do zarządzania harmonogramami zajęć grupowych i menu rozwijanymi ról.

---

## **Funkcje**

- 🎭 **Role Reakcji** – Twórz menu rozwijane do przypisywania ról.
- 📅 **Harmonogramy Zajęć** – Twórz, edytuj, kopiuj i wyświetlaj harmonogramy zajęć.
- ⚙️ **Konfiguracja Tylko dla Administratorów** – Konfiguruj kanały i ustawienia.
- 🌐 **Panel Webowy** – Sprawdź status bota i wyświetl aktualne harmonogramy.

---

## **Komendy**

### Role Reakcji
- `/createdropdown` — Twórz menu rozwijane do wyboru ról.
- `/listdropdowns` — Wyświetl wszystkie istniejące menu rozwijane.
- `/deletedropdown` — Usuń menu rozwijane.

### Harmonogramy
- `/schedule menu` — Utwórz nowy wpis harmonogramu (tylko administrator).
- `/schedule edit` — Edytuj istniejący harmonogram (tylko administrator).
- `/schedule delete` — Usuń harmonogram (tylko administrator).
- `/schedule copy` — Skopiuj harmonogram (tylko administrator).
- `/schedule list` — Wyświetl wszystkie aktualne harmonogramy.

### Konfiguracja Administratora
- `/schedule_addprofessor` — Dodaj profesora.
- `/schedule_addclassname` — Dodaj nazwę zajęć.
- `/schedule_addlocation` — Dodaj lokalizację.
- `/schedule_addchannel` — Ustaw kanał do publikowania harmonogramów.
- `/experiment_schedule` — Uruchom eksperyment harmonogramu z Book1.xlsx.
- `/createdropdown` — Zarządzaj menu rozwijanymi ról.

---

## **Uruchamianie**

Aby uruchomić bota:
```
node index.js
```

Aby zresetować bota (zabić wszystkie procesy Node.js i uruchomić ponownie):
```
./killscript.exe
```
