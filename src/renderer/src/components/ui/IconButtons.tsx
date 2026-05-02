import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconOnlyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  children: ReactNode
  label: string
}

type AddButtonProps = Omit<IconOnlyButtonProps, 'children'>
type RowActionButtonProps = Omit<IconOnlyButtonProps, 'className'>

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ')
}

export function IconOnlyButton({
  children,
  label,
  title = label,
  type = 'button',
  ...buttonProps
}: IconOnlyButtonProps): React.JSX.Element {
  return (
    <button {...buttonProps} type={type} aria-label={label} title={title}>
      {children}
    </button>
  )
}

export function AddButton({ className, ...buttonProps }: AddButtonProps): React.JSX.Element {
  return (
    <IconOnlyButton {...buttonProps} className={joinClassNames(className, 'add-button')}>
      +
    </IconOnlyButton>
  )
}

export function RowActionButton({
  children,
  ...buttonProps
}: RowActionButtonProps): React.JSX.Element {
  return (
    <IconOnlyButton {...buttonProps} className="row-action-button">
      {children}
    </IconOnlyButton>
  )
}
