import { useContext, type ReactNode } from 'react'
import { FoldBlock } from '../../components/FoldBlock'
import { MONEY_BLOCK_NAMES, MoneyBlocksContext, isBlockOpen, setBlockOpen, type MoneyBlock } from './moneyBlocks'

type Props = {
  block: MoneyBlock
  /** A short line shown while the block is closed, such as how many accounts there are. */
  summary: ReactNode
  /** Buttons next to the heading (Add …). They never close the block. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * One Money block: the same opening and closing as a Home block, with
 * Money's own open blocks. Closing it keeps its forms (and anything typed)
 * in the page: nothing is dropped.
 */
export function MoneyBlockFrame({ block, summary, actions, children }: Props) {
  const { view, onViewChange } = useContext(MoneyBlocksContext)
  const open = isBlockOpen(view, block)
  return (
    <FoldBlock title={MONEY_BLOCK_NAMES[block]} summary={summary} expanded={open} onToggle={() => onViewChange(setBlockOpen(view, block, !open))}
      actions={actions} className="data-block" dataset={{ 'data-money-block': block }}>
      {children}
    </FoldBlock>
  )
}
