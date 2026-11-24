# SellerOps

셀러 운영 자동화 사이드 프로젝트. 현재 계획: [사이드프로젝트_셀러운영자동화_8주계획_v2.md](사이드프로젝트_셀러운영자동화_8주계획_v2.md)

## 브랜치 규칙 (반드시 지킬 것)

전체 전략: @docs/branch-strategy.md

- `main`, `dev`에 직접 커밋하지 않는다. 작업은 항상 최신 `dev`에서 분기한 작업 브랜치(`feat/`, `fix/`, `refactor/`, `test/`, `docs/`, `chore/`)에서 한다.
- 작업 브랜치 PR의 대상은 `dev`다. `main`으로 가는 PR은 `dev` → `main`과 `hotfix/*`만 있다.
- push와 PR 생성은 사용자가 허락했을 때만 한다. **PR 머지는 사용자가 한다.**
- `main`, `dev`에 force push하지 않는다.
- 커밋 메시지는 Conventional Commits 형식(`feat(api): ...`)으로 쓴다.
