## Prerequisites

Pastikan sudah terinstall:
- Node.js v18+
- MongoDB (local) atau MongoDB Atlas (cloud)
- npm atau yarn

## Instalasi

### 1. Clone repository

git clone https://github.com/username/syntra-api.git
cd syntra-api

### 2. Install dependencies

npm install

### 3. Buat file .env

Buat file `.env` di root folder, isi dengan:

PORT=5000
MONGO_URI=mongodb://localhost:27017/attendance_db
JWT_SECRET=isi_dengan_string_random_yang_panjang
JWT_EXPIRES_IN=7d
OFFICE_LATITUDE=-6.2088
OFFICE_LONGITUDE=106.8456
OFFICE_RADIUS_METERS=100

Keterangan:
- MONGO_URI        → connection string MongoDB kamu
- JWT_SECRET       → string random bebas, makin panjang makin aman
- OFFICE_LATITUDE  → koordinat latitude lokasi petshop
- OFFICE_LONGITUDE → koordinat longitude lokasi petshop
- OFFICE_RADIUS_METERS → radius absen yang diizinkan (dalam meter)

### 4. Seed data awal (admin)

npm run seed

Perintah ini akan membuat:
- Akun admin default (email: admin@petshop.com, password: admin123)

### 5. Jalankan server

# Development
npm run dev

# Production
npm start

Server berjalan di http://localhost:5000
