# 브랜치 전략

```
main  ●───────────────────●──────────────────●   ← 검증된 상태만 (주차 단위 릴리스)
       \                 ↗ (merge commit)    ↗
dev     ●──●──────●─────●──────●──────●─────●     ← 통합·검증 브랜치
            \    ↗ \   ↗        \    ↗
작업         feat/…   fix/…      feat/…          ← dev에서 분기, dev로 PR (squash)
```

## 브랜치 역할

| 브랜치 | 역할 | 직접 커밋 | 들어오는 경로 |
|---|---|---|---|
| `main` | 항상 실행 가능한 검증된 상태 | 금지 | `dev` → `main` PR, `hotfix/*` PR |
| `dev` | 개발 통합 브랜치. 여기서 문제없는지 확인 | 금지 | 작업 브랜치 PR |
| 작업 브랜치 | 기능·수정 단위 작업 | 가능 | `dev`에서 분기 |

## 작업 브랜치 이름

`<타입>/<짧은-설명>` 형식, 소문자와 하이픈만 사용.

| 타입 | 용도 | 예시 |
|---|---|---|
| `feat/` | 새 기능 | `feat/week1-skeleton`, `feat/inquiry-webhook` |
| `fix/` | 버그 수정 | `fix/duplicate-send` |
| `refactor/` | 동작 변화 없는 구조 개선 | `refactor/llm-provider` |
| `test/` | 테스트 추가·수정 | `test/concurrent-approve` |
| `docs/` | 문서 | `docs/eval-v1` |
| `chore/` | 설정, 의존성, CI | `chore/ci-mysql-service` |
| `hotfix/` | `main`에서 발견된 급한 문제 (`main`에서 분기) | `hotfix/migration-error` |

## 흐름

1. **작업 시작:** 최신 `dev`에서 분기한다.
   ```
   git switch dev && git pull
   git switch -c feat/inquiry-webhook
   ```
2. **작업 → PR:** 작업 브랜치를 push하고 `dev`로 PR을 연다. CI가 통과해야 머지한다.
3. **`dev`로 머지:** **squash merge** (작업 브랜치 하나 = `dev`의 커밋 하나). 머지 후 작업 브랜치는 삭제한다.
4. **`main`으로 올리기:** 아래 조건을 만족하면 `dev` → `main` PR을 연다. **merge commit**으로 머지한다 (squash하면 `dev`와 `main`의 이력이 갈라져 다음 PR에서 충돌이 난다).
5. **태그:** `main`에 머지할 때 주차 태그를 단다 (`week-1`, `week-2` …).
6. **핫픽스:** `main`에서 `hotfix/*`를 분기 → `main`으로 PR → 머지 후 `main`을 `dev`에도 반영한다.

## `dev` → `main` 조건

- [ ] `dev`의 CI 통과
- [ ] `docker compose up`으로 전체 실행 확인
- [ ] 해당 주차 체크리스트 항목 완료 (계획서 8장)
- [ ] 마이그레이션이 빈 DB에서 처음부터 적용됨

보통 주차가 끝날 때 한 번 올린다. 주차 중간이라도 위 조건을 만족하는 의미 있는 단위면 올려도 된다.

## 커밋 메시지

[Conventional Commits](https://www.conventionalcommits.org/) 형식: `<타입>(<범위>): <설명>`

```
feat(api): 문의 웹훅 HMAC 서명 검증 추가
fix(runner): 잘못된 JSON 응답을 failed로 처리
chore(ci): MySQL 서비스 컨테이너 추가
```

범위 예시: `api`, `web`, `mock-mall`, `runner`, `shared`, `db`, `ci`, `docker`, `eval`

## GitHub 설정 (직접 해야 함)

- Settings → Rules(또는 Branches)에서 `main`, `dev`에 규칙 추가: PR 필수, CI 통과 필수, force push·삭제 금지
- 머지 방식: squash merge와 merge commit 허용, "Automatically delete head branches" 켜기
- ※ 확인 필요: 비공개 저장소는 GitHub 무료 플랜에서 브랜치 규칙이 강제되지 않을 수 있음. 그 경우 공개 저장소로 하거나 이 문서의 규칙을 스스로 지킨다.
