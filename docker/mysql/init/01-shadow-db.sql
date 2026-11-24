-- Prisma migrate dev가 마이그레이션 검증에 쓰는 임시(shadow) DB.
-- 앱 유저가 서버 전체 CREATE 권한 없이도 쓸 수 있게 전용 DB를 미리 만든다.
CREATE DATABASE IF NOT EXISTS sellerops_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON sellerops_shadow.* TO 'sellerops'@'%';
