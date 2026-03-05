# Design : Application de gestion de tickets (reçus)

Date : 2026-03-05

## Contexte

Application pour une petite entreprise suisse (2 utilisateurs). Permet de photographier les tickets de caisse, enregistrer les métadonnées comptables, et stocker le tout dans Dropbox avec un fichier Excel annuel pour le comptable.

## Architecture

- **Frontend** : Next.js PWA déployée sur Vercel (gratuit)
- **Stockage** : Dropbox API
  - Photos : `Dropbox/Tickets/YYYY/photos/`
  - Excel annuel : `Dropbox/Tickets/YYYY/YYYY.xlsx` (une feuille par mois, trié par date croissante)
- **Authentification** : Aucune — app partagée, token Dropbox en variable d'environnement Vercel

## Structure Dropbox

```
Dropbox/Tickets/
  └── 2026/
        ├── 2026.xlsx          (mis à jour automatiquement à chaque ajout)
        │     ├── Feuille : Janvier
        │     ├── Feuille : Février
        │     └── ...
        └── photos/
              ├── 2026-01-02_001.jpg
              └── ...
```

## Écrans

### 1. Liste des tickets (page d'accueil)
- Filtre par mois (dropdown)
- Liste triée par date décroissante (le plus récent en premier)
- Tap sur un ticket → détail

### 2. Ajouter un ticket
- Bouton pour prendre une photo (caméra iPhone)
- Champs :
  - Date : pré-remplie avec aujourd'hui, modifiable
  - Montant CHF : saisie manuelle, requis
  - Catégorie : liste déroulante, requis
- Bouton "Enregistrer" → upload photo + mise à jour Excel dans Dropbox

### 3. Détail d'un ticket
- Affichage de la photo
- Date, montant, catégorie
- Bouton "Supprimer"

## Catégories

- Repas 8.1%
- Repas 2.6%
- Repas mixte (8.1%+2.6%)
- Frais de représentation
- Frais de déplacements
- Frais de bureau

## Colonnes du fichier Excel

| Date | Montant (CHF) | Catégorie | Fichier photo |
|------|--------------|-----------|---------------|

Trié par date croissante. Une feuille par mois. Mis à jour à chaque nouveau ticket.

## Installation (une seule fois)

1. Créer une app Dropbox Developer → générer un refresh token
2. Déployer sur Vercel → variable d`environnement `DROPBOX_TOKEN`
3. Installer sur iPhone via Safari → "Ajouter à l'écran d'accueil"

## Contraintes UX

- Gros boutons, grande police (utilisateur de 70 ans)
- Tout en français
- Minimum d'étapes pour ajouter un ticket
