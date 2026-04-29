// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address from, address to, uint amount) external returns (bool);
    function transfer(address to, uint amount) external returns (bool);
}

contract LettuceMarket {

    IERC20 public yodaToken;
    address public marketOwner;

    uint public nextId;
    uint public nextAuctionId;

    struct Promotion {
        bool    isAuction;
        uint    listingId;
        address seller;
        uint    feePaid;
        uint    expiresAt;
    }

    Promotion[] public promotions;

    uint public nextPromotionId;

    event PromotionAdded(
        uint    indexed promotionIndex,
        bool    indexed isAuction,
        uint    indexed listingId,
        address seller,
        uint    feePaid,
        uint    expiresAt
    );
    event PromotionFeeUpdated(uint newFeePerDay);

    uint public promotionFeePerDay = 10 * 1e18;

    constructor(address _yodaToken) {
        yodaToken = IERC20(_yodaToken);
        marketOwner = msg.sender;
    }

    modifier onlyMarketOwner() {
        require(msg.sender == marketOwner, "Not market owner");
        _;
    }

    function setPromotionFeePerDay(uint newFee) external onlyMarketOwner {
        require(newFee > 0, "Fee must be > 0");
        promotionFeePerDay = newFee;
        emit PromotionFeeUpdated(newFee);
    }

    function promoteListing(uint listingId, uint durationDays) external {
        Lettuce storage item = lettuces[listingId];
        require(item.seller == msg.sender, "Not your listing");
        require(item.quantity > 0, "Listing is sold out");
        require(durationDays > 0, "Duration must be >= 1 day");

        _applyPromotion(false, listingId, msg.sender, durationDays);
    }

    function promoteAuction(uint auctionId, uint durationDays) external {
        Auction storage auction = auctions[auctionId];
        require(auction.seller == msg.sender, "Not your auction");
        require(!auction.finalized, "Auction already finalized");
        require(block.timestamp < auction.endTime, "Auction has ended");
        require(durationDays > 0, "Duration must be >= 1 day");

        _applyPromotion(true, auctionId, msg.sender, durationDays);
    }

    function _applyPromotion(
        bool isAuction,
        uint listingId,
        address seller,
        uint durationDays
    ) internal {
        uint totalFee = promotionFeePerDay * durationDays;

        require(
            yodaToken.transferFrom(msg.sender, marketOwner, totalFee),
            "Promotion fee payment failed"
        );

        uint expiresAt = block.timestamp + (durationDays * 1 days);

        Promotion memory promo = Promotion({
            isAuction: isAuction,
            listingId: listingId,
            seller:    seller,
            feePaid:   totalFee,
            expiresAt: expiresAt
        });

        promotions.push(promo);                    // add to end first
        uint i = promotions.length - 1;
        while (i > 0 && promotions[i].feePaid > promotions[i - 1].feePaid) {
            Promotion memory tmp = promotions[i - 1];
            promotions[i - 1] = promotions[i];
            promotions[i] = tmp;
            i--;
        }

        emit PromotionAdded(i, isAuction, listingId, seller, totalFee, expiresAt);
    }

    function getActivePromotions() external view returns (Promotion[] memory) {
        uint count = 0;
        for (uint i = 0; i < promotions.length; i++) {
            if (block.timestamp <= promotions[i].expiresAt) count++;
        }

        Promotion[] memory active = new Promotion[](count);
        uint idx = 0;
        for (uint i = 0; i < promotions.length; i++) {
            if (block.timestamp <= promotions[i].expiresAt) {
                active[idx++] = promotions[i];
            }
        }
        return active;
    }

 
    function totalPromotions() external view returns (uint) {
        return promotions.length;
    }



    struct Lettuce {
        uint id;
        address seller;
        uint pricePerUnit;
        uint quantity;
        string category;
        string quality;
    }

    mapping(uint => Lettuce) public lettuces;

    event LettuceListed(uint id, address seller, uint price, uint quantity);
    event LettucePurchased(uint id, address buyer, uint amount);

    function listLettuce(
        uint pricePerUnit,
        uint quantity,
        string memory category,
        string memory quality
    ) public {
        require(pricePerUnit > 0, "Price must be > 0");
        require(quantity > 0, "Quantity must be > 0");

        lettuces[nextId] = Lettuce({
            id: nextId,
            seller: msg.sender,
            pricePerUnit: pricePerUnit,
            quantity: quantity,
            category: category,
            quality: quality
        });

        emit LettuceListed(nextId, msg.sender, pricePerUnit, quantity);
        nextId++;
    }

    function buyLettuce(uint id, uint amount) public {
        Lettuce storage item = lettuces[id];
        require(item.quantity >= amount, "Not enough lettuce");

        uint finalAmount = amount;
        uint totalPrice = item.pricePerUnit * amount;

        if (amount >= 10) {
            totalPrice = (totalPrice * 80) / 100;
        }

        require(
            yodaToken.transferFrom(msg.sender, item.seller, totalPrice),
            "Payment failed"
        );

        require(item.quantity >= finalAmount, "Not enough stock for deal");
        item.quantity -= finalAmount;

        emit LettucePurchased(id, msg.sender, finalAmount);
    }

    function getLettuce(uint id) public view returns (Lettuce memory) {
        return lettuces[id];
    }

    struct Auction {
        uint id;
        address seller;
        string category;
        string quality;
        uint quantity;
        uint startingBid;
        uint highestBid;
        address highestBidder;
        uint endTime;
        bool finalized;       
    }

    mapping(uint => Auction) public auctions;

    mapping(uint => mapping(address => uint)) public pendingReturns;

    event AuctionCreated(
        uint indexed auctionId,
        address indexed seller,
        uint quantity,
        uint startingBid,
        uint endTime
    );
    event BidPlaced(
        uint indexed auctionId,
        address indexed bidder,
        uint amount
    );
    event AuctionFinalized(
        uint indexed auctionId,
        address indexed winner,
        uint winningBid
    );
    event BidWithdrawn(
        uint indexed auctionId,
        address indexed bidder,
        uint amount
    );

    function listLettuceAuction(
        uint quantity,
        uint startingBid,
        uint durationDays,
        string memory category,
        string memory quality
    ) public {
        require(quantity > 0, "Quantity must be > 0");
        require(startingBid > 0, "Starting bid must be > 0");
        require(durationDays > 0, "Duration must be at least 1 day");

        uint endTime = block.timestamp + (durationDays * 1 days);

        auctions[nextAuctionId] = Auction({
            id: nextAuctionId,
            seller: msg.sender,
            category: category,
            quality: quality,
            quantity: quantity,
            startingBid: startingBid,
            highestBid: 0,
            highestBidder: address(0),
            endTime: endTime,
            finalized: false
        });

        emit AuctionCreated(nextAuctionId, msg.sender, quantity, startingBid, endTime);
        nextAuctionId++;
    }

    function placeBid(uint auctionId, uint bidAmount) public {
        Auction storage auction = auctions[auctionId];

        require(block.timestamp < auction.endTime, "Auction has ended");
        require(!auction.finalized, "Auction already finalized");
        require(auction.seller != address(0), "Auction does not exist");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(
            bidAmount >= auction.startingBid,
            "Bid below starting price"
        );
        require(
            bidAmount > auction.highestBid,
            "Bid must exceed current highest bid"
        );

        require(
            yodaToken.transferFrom(msg.sender, address(this), bidAmount),
            "Token transfer failed"
        );

        if (auction.highestBidder != address(0)) {
            pendingReturns[auctionId][auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = bidAmount;
        auction.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, bidAmount);
    }

    function withdrawOutbidTokens(uint auctionId) public {
        uint amount = pendingReturns[auctionId][msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingReturns[auctionId][msg.sender] = 0;
        require(yodaToken.transfer(msg.sender, amount), "Refund failed");

        emit BidWithdrawn(auctionId, msg.sender, amount);
    }


    function finalizeAuction(uint auctionId) public {
        Auction storage auction = auctions[auctionId];

        require(auction.seller != address(0), "Auction does not exist");
        require(block.timestamp >= auction.endTime, "Auction still active");
        require(!auction.finalized, "Already finalized");

        auction.finalized = true;

        if (auction.highestBidder != address(0)) {
            require(
                yodaToken.transfer(auction.seller, auction.highestBid),
                "Payment to seller failed"
            );
            emit AuctionFinalized(auctionId, auction.highestBidder, auction.highestBid);
        } else {
            emit AuctionFinalized(auctionId, address(0), 0);
        }
    }


    function getAuction(uint auctionId) public view returns (Auction memory) {
        return auctions[auctionId];
    }


    function isAuctionActive(uint auctionId) public view returns (bool) {
        Auction storage auction = auctions[auctionId];
        return (
            !auction.finalized &&
            block.timestamp < auction.endTime &&
            auction.seller != address(0)
        );
    }
}
