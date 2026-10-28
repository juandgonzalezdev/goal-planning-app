import { useContext, type ReactNode } from 'react'
import { FoldBlock } from '../../components/FoldBlock'
import { DATA_BLOCK_NAMES, DataBlocksContext, isBlockOpen, setBlockOpen, type DataBlock } from './dataBlocks'

type Props = {
  block: DataBlock
  /** A short line shown while the block is closed, such as how many accounts there are. */
  summary: ReactNode
  /** Buttons next to the heading (Add …). They never close the block. */
  actions?: ReactNode
  children: ReactNode
}

/** One Data block: the same opening and closing as a Home block, with Data's own open blocks. */
export function DataBlockFrame({ block, summary, actions, children }: Props) {
  const { view, onViewChange } = useContext(DataBlocksContext)
  const open = isBlockOpen(view, block)
  return (
    <FoldBlock title={DATA_BLOCK_NAMES[block]} summary={summary} expanded={open} onToggle={() => onViewChange(setBlockOpen(view, block, !open))}
      actions={actions} className="data-block" dataset={{ 'data-data-block': block }}>
      {children}
    </FoldBlock>
  )
}
