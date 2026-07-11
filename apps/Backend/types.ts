import z from "zod"

export const CreateOrderSchema = z.object({
    marketId: z.string(),
    side: z.enum(["yes", "no"]),
    type: z.enum(["buy", "sell", "split", "merge"]),
    price: z.number().int(), // 10 => 01.10$
    qty: z.number().int()
})

export type Orderbook = {[key: string]: {
    availableQty: number,
    orders: {userId: string, qty: number, filledQty: number, originalOrderId: string }[]
}}