"""
Déplace les photos existantes dans des sous-dossiers par mois :
  photos/2026-01-05_7.90.jpg  ->  photos/01/2026-01-05_7.90.jpg
  photos/2026-03-12_18.00.jpg ->  photos/03/2026-03-12_18.00.jpg
  etc.

Aucun changement dans tickets.json (le nom de fichier reste le même).
"""

import os
import shutil

PHOTOS_DIR = r"C:\Users\Robin\Dropbox\Applications\Robalex_ticket\Tickets\2026\photos"


def main():
    files = [f for f in os.listdir(PHOTOS_DIR)
             if f.endswith('.jpg') and not os.path.isdir(os.path.join(PHOTOS_DIR, f))]

    print(f"{len(files)} photos a deplacer\n")

    moves = []
    for filename in sorted(files):
        # Extraire le mois depuis YYYY-MM-DD (positions 5-6)
        if len(filename) >= 7 and filename[4] == '-' and filename[7] == '-':
            month = filename[5:7]
        else:
            print(f"  Nom inattendu, ignore : {filename}")
            continue
        moves.append((filename, month))

    for filename, month in moves[:5]:
        print(f"  {filename} -> {month}/{filename}")
    if len(moves) > 5:
        print(f"  ... et {len(moves) - 5} autres")

    confirm = input("\nConfirmer ? (o/n) : ").strip().lower()
    if confirm != "o":
        print("Annule.")
        return

    errors = []
    for filename, month in moves:
        month_dir = os.path.join(PHOTOS_DIR, month)
        os.makedirs(month_dir, exist_ok=True)

        src = os.path.join(PHOTOS_DIR, filename)
        dst = os.path.join(month_dir, filename)

        try:
            shutil.move(src, dst)
        except Exception as e:
            print(f"  Erreur {filename}: {e}")
            errors.append(filename)

    print(f"\n{len(moves) - len(errors)} photos deplacees.")
    if errors:
        print(f"Erreurs : {errors}")
    else:
        print("Migration terminee sans erreur.")


if __name__ == "__main__":
    main()
