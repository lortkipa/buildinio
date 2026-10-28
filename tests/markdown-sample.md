# Everything an answer can show

Answers can be **bold**, *italic*, ***both***, ~~struck out~~, `inline code` and [links](https://example.com).

## Lists

- Plain points
- With **bold** inside
  - And a nested one
- Last point

1. Numbered steps
2. One after another
3. In order

- [x] A task that's done
- [ ] One that isn't yet

### A quote

> Good design is as little design as possible.
> It concentrates on the essential.

---

## A table

| Plan | Price | Projects | Support |
| :--- | ---: | :---: | --- |
| Free | $0 | 3 | Community |
| Pro | $12 | Unlimited | Email, within a day |
| Team | $40 | Unlimited | **Priority**, with a shared Slack channel |

## Code

```tsx
import { useState } from "react";

// A counter that starts at zero.
export function Counter({ step = 1 }: { step?: number }) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + step)}>Clicked {count} times</button>;
}
```

```python
from dataclasses import dataclass

@dataclass
class Recipe:
    name: str
    minutes: int = 30

    def is_quick(self) -> bool:
        """Under twenty minutes."""
        return self.minutes < 20
```

```css
.card:hover {
  color: #e11d48;
  transform: translateY(-2px);
}
```

```bash
npm install && npm run build # Builds into dist/
```

```sql
SELECT name, COUNT(*) AS orders FROM customers JOIN orders USING (id) WHERE total > 100 GROUP BY name;
```

```json
{ "name": "app", "private": true, "version": 1.2, "tags": ["vite", null] }
```

```diff
- const color = "blue";
+ const color = "orange";
```

#### A smaller heading

That's all of it.
