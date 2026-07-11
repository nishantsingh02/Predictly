import "dotenv/config";
import express from "express";
import cors from "cors"
import { middleware } from "./middleware";
import { prisma } from "db"
import { CreateOrderSchema } from "./types";
import type { Orderbook } from "./types";
import { uuid } from "uuidv4";


const app = express();

app.use(express.json())
app.use(cors());


app.post("/buy", middleware, async (req, res) => {
    const { success, data } = CreateOrderSchema.safeParse(req.body) // response giving by user after zod validation
    const userId: string = req.userId; // from that middleware

    if (!success) {
        return res.status(411).json({ msg: "incorrect type" })
    }

    try {
        await prisma.$transaction(
            async txn => {
                // market
                const response = await txn.$queryRaw<{ yesOrderbook: string; noOrderbook: string; id: string, totalQty: number }>`SELECT * FROM "Market" WHERE id=${data.marketId} FOR UPDATE;`

                //user
                const userResponse = await txn.$queryRaw<{ id: string, address: string, usdBalance: number }>`SELECT * FROM "User" WHERE id=${userId} FOR UPDATE`

                if (!userResponse || (Array.isArray(userResponse) && userResponse.length === 0)) {
                    throw new Error("User Not found")
                }

                if (!response || (Array.isArray(response) && response.length === 0)) {
                    throw new Error("Market not found")
                }

                const yesOrderbook: Orderbook = JSON.parse(response.yesOrderbook)
                const noOrderbook: Orderbook = JSON.parse(response.noOrderbook)

                // for buy a yes 
                if (data.side == "yes" && data.type == "buy") {
                    // usd they have to spent
                    const usd = data.qty * data.price;
                    if(userResponse.usdBalance < usd) {
                        res.status(403).json({
                            msg: "insufficent balance"
                        })
                        return;
                    } 

                    let leftQty = data.qty;

                    const originalOrderId = uuid() // genrate a random uuid 

                    const prices = Object.keys(yesOrderbook).sort((a: string, b: string) => Number(a) - Number(b) )
                    
                    await Promise.all(prices.map(async price => {
                        if (Number(price) > data.price) {
                            return;
                        }
                        const { availableQty, orders } = yesOrderbook[price]!
                        
                        await Promise.all(orders.map(async order => {
                            const matchdQty = order.qty >= leftQty ? leftQty : order.qty
                                await prisma.position.update({
                                    where: {
                                        userId_marketId_type: {
                                            userId,
                                            marketId: data.marketId,
                                            type: "Yes"
                                        }
                                    },
                                    data: {
                                        qty: {
                                            decrement: matchdQty
                                        }
                                    },
                                })

                                await prisma.user.update({
                                    where: {
                                        id: order.userId
                                    },
                                    data: {
                                        usdBalance: {
                                            increment: Number(price) * matchdQty
                                        }
                                    }
                                })

                                await prisma.position.update({
                                    where: {
                                        userId_marketId_type: {
                                            userId,
                                            marketId: data.marketId,
                                            type: "Yes"
                                        }
                                    },
                                    data: {
                                        qty: {
                                            decrement: matchdQty
                                        }
                                    },
                                })

                                await prisma.user.update({
                                    where: {
                                        id: userId
                                    },
                                    data: {
                                        usdBalance: {
                                            decrement: Number(price) * matchdQty
                                        }
                                    }
                                })

                                leftQty -= matchdQty;
                                order.filledQty += matchdQty;
                                yesOrderbook[price]!.availableQty -= matchdQty // update the yes order book that we can just shuv on the db
                            
                        }))
                    }))

                    // if we left with some qty in order book the we need to do this 
                    if(!yesOrderbook[data.price]) {
                        yesOrderbook[data.price] = {availableQty: 0, orders: []}
                    }

                    yesOrderbook[data.price]!.availableQty += leftQty;
                    yesOrderbook[data.price]!.orders.push({userId, qty: leftQty, filledQty: 0, originalOrderId: originalOrderId })
                } 

                

                // for sell a yes 
                if (data.side == "yes" && data.type == "sell") {

                }

                txn.market.update({
                    data : {
                        yesOrderbook: JSON.stringify(yesOrderbook),
                        noOrderbook: JSON.stringify(noOrderbook)
                    },
                    where :{
                        id: data.marketId
                    }
                })

                console.log("response", response)
            },
            { maxWait: 5000, timeout: 10000 } // wait up to 5s and kill the txn if its run more then 10s
        )
        res.json({ msg: "Buy complete" })
    } catch (e) {
        res.status(500).json({
            msg: e instanceof Error ? e.message : "Transaction failed",
        })
    }
})

app.get("/markets", async (req, res) => {
    const markets = await prisma.market.findMany();
    res.json({
        markets
    });
});



app.post("/sell",middleware,  (req, res) => {
    
})

app.post("/split",middleware,  (req, res) => {
    
})

app.get("/merge",middleware,  (req, res) => {
    console.log(req.headers.authorization);
    res.json({
        msg: "working fine"
    })
})

app.get("/balance",middleware,  (req, res) => {
    
})

app.post("/history",middleware,  (req, res) => {
    
})

app.listen(3000)