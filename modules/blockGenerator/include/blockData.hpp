#pragma once

#include <iostream>
#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <random>
#include <cmath>
#include <numbers>
#include <string>
#include <sstream>
#include <iomanip>
#include <fstream>
#include <tuple>

#define MAX_SIZE 13
#define EPSILON 1e-12
#define DEFAULT_WEIGHT 100.0
#define DENSITY_COEFF 0.02

typedef std::tuple<int, int, int> Tuple;
typedef std::pair<int, int> Pair;

using std::get;

struct BlockStateKey
{
    static constexpr std::size_t CELL_COUNT = MAX_SIZE * MAX_SIZE;
    static constexpr std::size_t BYTE_COUNT = (CELL_COUNT + 1) / 2;

    std::array<std::uint8_t, BYTE_COUNT> heights = {};
    std::uint64_t hash_value = 0;

    static std::uint64_t heightToken(std::size_t index, std::uint8_t height)
    {
        if (height == 0)
            return 0;

        std::uint64_t value = static_cast<std::uint64_t>(index * 16 + height);
        value += 0x9e3779b97f4a7c15ULL;
        value = (value ^ (value >> 30)) * 0xbf58476d1ce4e5b9ULL;
        value = (value ^ (value >> 27)) * 0x94d049bb133111ebULL;
        return value ^ (value >> 31);
    }

    std::uint8_t getHeight(std::size_t index) const
    {
        std::uint8_t value = heights[index / 2];
        int shift = static_cast<int>((index % 2) * 4);
        return static_cast<std::uint8_t>((value >> shift) & 0x0F);
    }

    void setHeight(std::size_t index, std::uint8_t height)
    {
        std::uint8_t previous_height = getHeight(index);

        if (previous_height == height)
            return;

        int shift = static_cast<int>((index % 2) * 4);
        std::uint8_t mask = static_cast<std::uint8_t>(0x0F << shift);
        heights[index / 2] = static_cast<std::uint8_t>(
            (heights[index / 2] & ~mask) |
            static_cast<std::uint8_t>(height << shift)
        );
        hash_value ^= heightToken(index, previous_height);
        hash_value ^= heightToken(index, height);
    }

    bool operator==(const BlockStateKey& other) const
    {
        return heights == other.heights;
    }
};

struct BlockStateKeyHash
{
    std::size_t operator()(const BlockStateKey& key) const
    {
        if constexpr (sizeof(std::size_t) < sizeof(std::uint64_t))
        {
            return static_cast<std::size_t>(
                key.hash_value ^ (key.hash_value >> 32)
            );
        }

        return static_cast<std::size_t>(key.hash_value);
    }
};

class blockData
{
private:
    using Transition = std::pair<Tuple, double>;
    using ExhaustedStateSet = std::unordered_set<BlockStateKey, BlockStateKeyHash>;

#ifdef __EMSCRIPTEN__
    static constexpr std::size_t MAX_EXHAUSTED_STATE_COUNT = 50000;
    static constexpr std::size_t TRANSITION_CACHE_BUDGET = 12 * 1024 * 1024;
#else
    static constexpr std::size_t MAX_EXHAUSTED_STATE_COUNT = 200000;
    static constexpr std::size_t TRANSITION_CACHE_BUDGET = 64 * 1024 * 1024;
#endif

    // condition
    Pair block_count_pair;    // max : max_r * max_c * max_h
    int block_count;          // current block_count : randomly decided in block_count_pair
    int max_r, max_c, max_h;  // max : MAX_SIZE
    double density_var = 0;
    Pair start_point;
    bool allow_duplicate;

    // status
    int biggest_r = 0, biggest_c = 0, biggest_h = 0;
    int smallest_r = MAX_SIZE, smallest_c = MAX_SIZE;
    int size_r = 0, size_c = 0, size_h = 0;
    std::unordered_set<std::string> created_list;
    std::vector<ExhaustedStateSet> exhausted_states_by_count;
    std::vector<bool> exhausted_block_counts;
    std::size_t exhausted_state_count = 0;
    std::unordered_map<BlockStateKey, std::vector<Transition>, BlockStateKeyHash> transition_cache;
    std::size_t transition_cache_bytes = 0;
    bool is_generated = false;

    // weight
    double weight_field[MAX_SIZE][MAX_SIZE][MAX_SIZE + 1] = {};

    // data
    bool cubic_data[MAX_SIZE][MAX_SIZE][MAX_SIZE + 1] = {};
    int height_data[MAX_SIZE][MAX_SIZE] = {};

    // block generate
    void makeBlock();
    bool makeUniqueBlock();
    bool makeUniqueBlock(int target_count);
    bool findUniqueCompletion(int target_count);
    std::vector<Transition> getCreatableTransitions();
    std::vector<Transition> getAvailableTransitions(int target_count);
    bool isAdditionAdjacent(int r, int c, int h) const;
    void setStartPoint();

    // setting weight
    bool checkCreatable(int r, int c, int h); // check invisibility and max size limit
    bool checkObscure(int r, int c, int h);
    double getWeight(int r, int c, int h); // get modified weight
    void setWeight(); // calculate initial weight

    // set status
    void init(); // initialize data
    void measureSize(Tuple t); // measure current size
    BlockStateKey getStateIdentify() const;
    void cacheExhaustedState(int target_count, BlockStateKey state);

public:
    blockData(int _bc1, int _bc2, int _max_r, int _max_c, int _max_h, double _den = 25, bool _dup = 0)
        : max_r(_max_r), max_c(_max_c), max_h(_max_h), density_var(_den), allow_duplicate(_dup)
    {
        block_count_pair = {std::min(_bc1, _bc2), std::max(_bc1, _bc2)};

        if (
            block_count_pair.first > max_r * max_c * max_h ||
            block_count_pair.second > max_r * max_c * max_h ||
            block_count_pair.first < 1 ||
            block_count_pair.second < 1
        )
        {
            if (block_count_pair.first > max_r * max_c * max_h)
                block_count_pair.first = max_r * max_c * max_h;
            if (block_count_pair.second > max_r * max_c * max_h)
                block_count_pair.second = max_r * max_c * max_h;
            if (block_count_pair.first < 1)
                block_count_pair.first = 1;
            if (block_count_pair.second < 1)
                block_count_pair.second = 1;
        }

        if (
            _max_r > MAX_SIZE || _max_c > MAX_SIZE || _max_h > MAX_SIZE ||
            _max_r < 1 || _max_c < 1 || _max_h < 1
        )
        {
            std::cout << "[ blockData ] : Max size value is invalid. Please initialize block data." << std::endl;
            max_r = 1;
            max_c = 1;
            max_h = 1;
        }

        exhausted_states_by_count.resize(block_count_pair.second + 1);
        exhausted_block_counts.resize(block_count_pair.second + 1, false);

        std::cout << "[ blockData ] : BlockData generated." << std::endl;
        setWeight();
    }

    void generateBlock(); // make new Block data

    bool getData(int r, int c, int h) const { return cubic_data[r][c][h]; }
    int getHeightData(int r, int c) const { return height_data[r][c]; }
    int getMaxRow() const { return max_r; }
    int getMaxCol() const { return max_c; }
    int getMaxHeight() const { return max_h; }
    int getSizeRow() const { return size_r; }
    int getSizeCol() const { return size_c; }
    int getSizeHeight() const { return size_h; }
    std::tuple<float, float, float> getCenter() const
    {
        return std::make_tuple(
            static_cast<float>(biggest_r + smallest_r) / 2,
            static_cast<float>(biggest_c + smallest_c) / 2,
            static_cast<float>(biggest_h - 1) / 2
        );
    }
    int getBlockCount() const { return block_count; }
    bool isGenerated() const { return is_generated; }

    // utility
    std::string getIdentify() const; // get identity of current block pattern
    void printBlockData();
};
