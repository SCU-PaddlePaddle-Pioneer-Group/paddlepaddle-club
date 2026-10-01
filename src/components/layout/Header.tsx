import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Menu } from 'lucide-react'
import { CLUB } from '@/data/club'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const NAV_ITEMS = [
  { to: '/', label: '首页' },
  { to: '/posts', label: '社团动态' },
  { to: '/about', label: '关于社团' },
] as const

/** 当前路由高亮：首页精确匹配（锚点不高亮），其余按前缀匹配。 */
function isActivePath(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

export default function Header() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="container-x flex h-[72px] items-center justify-between gap-6">
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label={CLUB.name}>
          <img src={asset('images/logo.png')} alt="" className="h-8 w-8" />
          <span className="flex flex-col">
            <span className="font-display text-[15px] font-bold leading-tight">{CLUB.name}</span>
            <span className="mt-1 font-mono text-[10px] uppercase leading-none tracking-[0.2em] text-muted-foreground">
              {CLUB.nameEn}
            </span>
          </span>
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="主导航">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'link-slide text-[15px] font-medium transition-colors duration-200',
                  active ? 'is-active text-foreground' : 'text-foreground/70 hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
          <Link to="/#join" className="btn-primary px-5 py-2.5 text-[14px]">
            加入我们
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </Link>
        </nav>

        {/* 移动端汉堡菜单 */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center text-foreground transition-colors duration-200 hover:text-primary"
                aria-label="打开菜单"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="border-border">
              <SheetHeader className="border-b border-border px-6 py-5">
                <SheetTitle className="flex items-center gap-3">
                  <img src={asset('images/logo.png')} alt="" className="h-7 w-7" />
                  <span className="font-display text-[15px] font-bold">{CLUB.name}</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-6 px-6 pt-8" aria-label="移动端导航">
                {NAV_ITEMS.map((item) => {
                  const active = isActivePath(pathname, item.to)
                  return (
                    <SheetClose asChild key={item.to}>
                      <Link
                        to={item.to}
                        className={cn(
                          'link-slide w-fit font-display text-[19px] font-semibold transition-colors duration-200',
                          active ? 'is-active text-foreground' : 'text-foreground/70 hover:text-foreground',
                        )}
                      >
                        {item.label}
                      </Link>
                    </SheetClose>
                  )
                })}
                <SheetClose asChild>
                  <Link to="/#join" className="btn-primary mt-4 w-fit">
                    加入我们
                    <span className="btn-arrow" aria-hidden>
                      →
                    </span>
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
